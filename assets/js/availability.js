/* ============================================================
   AVAILABILITY ENGINE — pure scheduling logic, no DOM, no network
   ------------------------------------------------------------
   This file is deliberately free of everything else: no document,
   no fetch, no config import. It takes facts in, returns slots out,
   which is what makes it testable (tests/availability.html) and what
   makes it safe to mirror in SQL.

   THE RULE
   An appointment occupies its resource for [start, end) where
       end = start + service duration + turnaround buffer
   Two appointments on the SAME resource conflict when
       newStart < existingEnd  &&  newEnd > existingStart
   Touching intervals do not conflict: an appointment ending exactly
   when another starts is fine, which is why the buffer is part of
   `end` rather than a separate fudge factor.

   WHO IS AUTHORITATIVE
   Postgres is. supabase/schema.sql implements this same rule inside a
   transaction and enforces it with a constraint, so two customers
   racing for 5:00 PM cannot both win. This module gives the customer
   an instant, correct-looking grid and powers the preview when no
   backend is connected; it never gets the final word.

   TIME
   All arithmetic is in "minutes since midnight, salon-local". Dates
   are 'YYYY-MM-DD' strings in salon-local time. There is no Date
   maths on local times anywhere in here, which is what keeps
   Asia/Kolkata (UTC+5:30) from drifting a day in either direction.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  root.SalonAvailability = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- time helpers ---------- */

  /* 'HH:MM' or 'HH:MM:SS' -> minutes since midnight. Throws on junk
     rather than returning NaN and silently poisoning every comparison. */
  function parseTime(value) {
    var m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(value).trim());
    if (!m) throw new Error('Invalid time: ' + value);
    var h = parseInt(m[1], 10);
    var min = parseInt(m[2], 10);
    if (h > 23 || min > 59) throw new Error('Invalid time: ' + value);
    return h * 60 + min;
  }

  function formatTime(minutes) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* Customer-facing label. Mumbai reads 12-hour time. */
  function formatTimeLabel(minutes) {
    var h24 = Math.floor(minutes / 60);
    var m = minutes % 60;
    var suffix = h24 < 12 ? 'AM' : 'PM';
    var h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + suffix;
  }

  function isValidDateString(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
    var parts = String(value).split('-');
    var y = +parts[0], mo = +parts[1], d = +parts[2];
    if (mo < 1 || mo > 12 || d < 1) return false;
    return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
  }

  /* Weekday with Monday = 0, derived from the date string itself via a
     UTC date so the host machine's own timezone cannot shift it. */
  function weekdayMondayFirst(dateString) {
    if (!isValidDateString(dateString)) throw new Error('Invalid date: ' + dateString);
    var parts = dateString.split('-');
    var dow = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])).getUTCDay(); // Sun = 0
    return (dow + 6) % 7;
  }

  function addDays(dateString, days) {
    var parts = dateString.split('-');
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /* "What is the date and time right now, in the salon's city?"
     Intl does the zone maths, so DST rules and the +5:30 offset are the
     platform's problem and not ours. `instant` defaults to now and is
     injectable so tests can pin the clock. */
  function salonNow(timeZone, instant) {
    var when = instant ? new Date(instant) : new Date();
    var parts;
    try {
      parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(when);
    } catch (e) {
      // Unknown zone: fall back to the device clock rather than crash.
      return {
        date: when.getFullYear() + '-' +
              String(when.getMonth() + 1).padStart(2, '0') + '-' +
              String(when.getDate()).padStart(2, '0'),
        minutes: when.getHours() * 60 + when.getMinutes(),
        zoneResolved: false
      };
    }
    var get = function (type) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
      return '00';
    };
    var hour = get('hour') === '24' ? '00' : get('hour'); // some ICU builds report 24
    return {
      date: get('year') + '-' + get('month') + '-' + get('day'),
      minutes: parseInt(hour, 10) * 60 + parseInt(get('minute'), 10),
      zoneResolved: true
    };
  }

  /* ---------- the overlap rule ---------- */

  /* Half-open intervals: [aStart, aEnd) vs [bStart, bEnd). */
  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && aEnd > bStart;
  }

  /* ---------- slot computation ---------- */

  /*
    computeSlots({
      service:      { duration, buffer, resource }   required
      date:         'YYYY-MM-DD'                     required
      hours:        { open:'10:00', close:'20:00' } | null   null = closed
      resourceCount: 1,
      bookings:     [{ resource, start, end }]  salon-local 'HH:MM';
                    `end` must already include that booking's buffer.
                    Entries for other resources are ignored.
      now:          { date, minutes }  salon-local; omit to disable the
                    past-time filter (useful when rendering a future date)
      slotStepMinutes: 15,
      leadTimeMinutes: 60
    })
    -> { date, closed, slots: [{ minutes, time, label, available, reason, resourceIndex }],
         availableCount }

    Every candidate start inside opening hours is returned, with
    `available` and a machine-readable `reason`. The UI renders the
    unavailable ones as disabled with a real explanation instead of
    hiding them, so "is 5pm gone, or does this salon just not open
    then?" has an answer.
  */
  function computeSlots(options) {
    var opts = options || {};
    var service = opts.service;
    if (!service) throw new Error('computeSlots: service is required');
    if (typeof service.duration !== 'number' || !(service.duration > 0)) {
      throw new Error('computeSlots: service.duration must be a positive number');
    }
    if (!isValidDateString(opts.date)) throw new Error('computeSlots: invalid date ' + opts.date);

    var step = opts.slotStepMinutes || 15;
    var lead = typeof opts.leadTimeMinutes === 'number' ? opts.leadTimeMinutes : 0;
    var buffer = typeof service.buffer === 'number' ? service.buffer : 0;
    var block = service.duration + buffer;
    var resourceCount = Math.max(1, opts.resourceCount || 1);

    if (!opts.hours) {
      return { date: opts.date, closed: true, slots: [], availableCount: 0 };
    }

    var open = parseTime(opts.hours.open);
    var close = parseTime(opts.hours.close);
    if (close <= open) throw new Error('computeSlots: closing time must be after opening time');

    /* Only bookings on the resource this service needs can conflict.
       A manicure cannot block a haircut. */
    var relevant = (opts.bookings || [])
      .filter(function (b) { return !b.resource || b.resource === service.resource; })
      .map(function (b) {
        return {
          index: typeof b.resourceIndex === 'number' ? b.resourceIndex : 0,
          start: typeof b.start === 'number' ? b.start : parseTime(b.start),
          end: typeof b.end === 'number' ? b.end : parseTime(b.end)
        };
      });

    /* The treatment itself must finish by closing time. The turnaround
       buffer may run past it — staff cleaning up after the last client
       is not a reason to refuse the last appointment. */
    var lastStart = close - service.duration;

    var earliestAllowed = null;
    if (opts.now && opts.now.date === opts.date) {
      earliestAllowed = opts.now.minutes + lead;
    } else if (opts.now && opts.date < opts.now.date) {
      // The whole day is in the past.
      earliestAllowed = Infinity;
    }

    var slots = [];
    var availableCount = 0;

    for (var start = open; start <= lastStart; start += step) {
      var slot = {
        minutes: start,
        time: formatTime(start),
        label: formatTimeLabel(start),
        available: false,
        reason: null,
        resourceIndex: null
      };

      if (earliestAllowed !== null && start < earliestAllowed) {
        slot.reason = 'past';
        slots.push(slot);
        continue;
      }

      // First free resource wins, mirroring the assignment in SQL.
      var chosen = null;
      for (var idx = 0; idx < resourceCount; idx++) {
        var clash = false;
        for (var i = 0; i < relevant.length; i++) {
          var b = relevant[i];
          if (b.index !== idx) continue;
          if (overlaps(start, start + block, b.start, b.end)) { clash = true; break; }
        }
        if (!clash) { chosen = idx; break; }
      }

      if (chosen === null) {
        slot.reason = 'booked';
      } else {
        slot.available = true;
        slot.resourceIndex = chosen;
        availableCount++;
      }
      slots.push(slot);
    }

    return { date: opts.date, closed: false, slots: slots, availableCount: availableCount };
  }

  /* Does this date fall inside the window the salon takes bookings for?
     Used to disable calendar days without duplicating the rule. */
  function isDateBookable(dateString, now, horizonDays) {
    if (!isValidDateString(dateString)) return false;
    if (dateString < now.date) return false;
    if (horizonDays && dateString > addDays(now.date, horizonDays)) return false;
    return true;
  }

  return {
    parseTime: parseTime,
    formatTime: formatTime,
    formatTimeLabel: formatTimeLabel,
    isValidDateString: isValidDateString,
    weekdayMondayFirst: weekdayMondayFirst,
    addDays: addDays,
    salonNow: salonNow,
    overlaps: overlaps,
    computeSlots: computeSlots,
    isDateBookable: isDateBookable
  };
});
