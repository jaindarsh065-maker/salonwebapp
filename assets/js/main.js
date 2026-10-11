
const SUPABASE_URL = 'https://kouwlhuazgugzmrxpprf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvdXdsaHVhemd1Z3ptcnhwcHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTcwNzcsImV4cCI6MjA4OTQ5MzA3N30.no3mpNpuiOVXeM9aN2UZn4d_OWj6r_2VR8OZ6bbSetM';
let supabaseClient;
function ensureSDKs() {
  if (!supabaseClient && window.supabase) { supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
}
try { ensureSDKs(); } catch(e) { console.warn('SDK init deferred:', e); }

const EMAILJS_SERVICE = 'service_35kl1sa';
const EMAILJS_TEMPLATE_CLIENT = 'template_m21ptgc';
const EMAILJS_TEMPLATE_ADMIN = 'template_2rw9vae';
const ADMIN_EMAIL = 'Beauty.Glanz@web.de';

const LANGS = ['de','ru','en'];
const LANG_LABELS = {de:'RU',ru:'EN',en:'DE'};
let currentLang = 'de';
let activeCategory = 'nails';

const services = [
  {id:'nails',de:'Nägel & Maniküre',ru:'Ногти и Маникюр',en:'Nails & Manicure',items:[
    {de:'Neumodellage Natur',ru:'Наращивание (натуральный)',en:'New set (natural)',p:'50 €'},
    {de:'Neumodellage Farben',ru:'Наращивание (цвет)',en:'New set (color)',p:'59 €'},
    {de:'Neumodellage French/Babyboomer',ru:'Наращивание French/Babyboomer',en:'New set French/Babyboomer',p:'69 €'},
    {de:'Auffüllen Natur',ru:'Коррекция (натуральный)',en:'Refill (natural)',p:'44 €'},
    {de:'Auffüllen Farben',ru:'Коррекция (цвет)',en:'Refill (color)',p:'49 €'},
    {de:'Auffüllen French/Babyboomer',ru:'Коррекция French/Babyboomer',en:'Refill French/Babyboomer',p:'55 €'},
    {de:'Maniküre-Classic ohne Lack',ru:'Классический маникюр (без лака)',en:'Classic manicure (no polish)',p:'30 €'},
    {de:'Maniküre mit Lack',ru:'Маникюр с лаком',en:'Manicure with polish',p:'40 €'},
    {de:'Nail-Art, pro Nagel',ru:'Дизайн ногтей, 1 ноготь',en:'Nail art, per nail',p:'2 €'},
    {de:'Swarovski Steine 1 Stk.',ru:'Камни Swarovski 1 шт.',en:'Swarovski stones 1 pc.',p:'0,50 €'},
    {de:'Reparatur Nagel',ru:'Ремонт ногтя',en:'Nail repair',p:'5 €'},
  ]},
  {id:'pedicure',de:'Pediküre & SPA',ru:'Педикюр и SPA',en:'Pedicure & SPA',items:[
    {de:'Pediküre-Classic ohne Lack',ru:'Классический педикюр (без лака)',en:'Classic pedicure (no polish)',p:'40 €'},
    {de:'Pediküre mit Lack',ru:'Педикюр с лаком',en:'Pedicure with polish',p:'46 €'},
    {de:'Pediküre Gel-Lack / Shellac',ru:'Педикюр гель-лак / Shellac',en:'Pedicure gel polish / Shellac',p:'56 €'},
    {de:'Smart-Pediküre ohne Lack',ru:'Смарт-педикюр (без лака)',en:'Smart pedicure (no polish)',p:'50 €'},
    {de:'Smart-Pediküre mit Lack',ru:'Смарт-педикюр с лаком',en:'Smart pedicure with polish',p:'59 €'},
    {de:'Smart-Pediküre mit Gel-Lack',ru:'Смарт-педикюр с гель-лаком',en:'Smart pedicure with gel polish',p:'69 €'},
    {de:'SPA Fußpflege (Peeling, Maske, Aroma Kerze)',ru:'SPA педикюр (пилинг, маска, аромасвеча)',en:'SPA pedicure (peeling, mask, candle)',p:'50 €'},
    {de:'SPA Füße mit Lack',ru:'SPA педикюр с лаком',en:'SPA pedicure with polish',p:'59 €'},
    {de:'SPA Füße mit Gel-Lack',ru:'SPA педикюр с гель-лаком',en:'SPA pedicure with gel polish',p:'69 €'},
  ]},
  {id:'brows',de:'Augenbrauen & Lifting',ru:'Брови и Лифтинг',en:'Brows & Lifting',items:[
    {de:'Wimpernlifting mit färben',ru:'Лифтинг ресниц + окрашивание',en:'Lash lifting + tinting',p:'70 €'},
    {de:'Augenbrauenlifting mit färben',ru:'Лифтинг бровей + окрашивание',en:'Brow lifting + tinting',p:'75 €'},
    {de:'Augenbrauen färben mit Henna',ru:'Окрашивание бровей хной',en:'Brow tinting with henna',p:'40 €'},
    {de:'Wimpern färben',ru:'Окрашивание ресниц',en:'Lash tinting',p:'15 €'},
    {de:'Augenbrauen färben',ru:'Окрашивание бровей',en:'Brow tinting',p:'15 €'},
    {de:'Augenbrauen zupfen',ru:'Коррекция бровей',en:'Brow shaping',p:'15 €'},
  ]},
  {id:'lashes',de:'Wimpernverlängerung',ru:'Наращивание ресниц',en:'Lash Extensions',items:[
    {de:'Naturlashes Look, Classic 1:1 Neu',ru:'Классика 1:1 (Новое)',en:'Classic 1:1 (New set)',p:'79 €'},
    {de:'Auffüllung bis 2 Wochen',ru:'Коррекция (до 2 нед.)',en:'Refill (up to 2 weeks)',p:'39 €'},
    {de:'Auffüllung bis 3 Wochen',ru:'Коррекция (до 3 нед.)',en:'Refill (up to 3 weeks)',p:'49 €'},
    {de:'Auffüllung bis 4 Wochen',ru:'Коррекция (до 4 нед.)',en:'Refill (up to 4 weeks)',p:'59 €'},
    {de:'Mascara Look 2-3D Neu',ru:'Mascara Look 2-3D (Новое)',en:'Mascara Look 2-3D (New set)',p:'89 €'},
    {de:'Auffüllung 2-3D bis 2 Wochen',ru:'Коррекция 2-3D (до 2 нед.)',en:'Refill 2-3D (up to 2 weeks)',p:'40 €'},
    {de:'Auffüllung 2-3D bis 3 Wochen',ru:'Коррекция 2-3D (до 3 нед.)',en:'Refill 2-3D (up to 3 weeks)',p:'59 €'},
    {de:'Auffüllung 2-3D bis 4 Wochen',ru:'Коррекция 2-3D (до 4 нед.)',en:'Refill 2-3D (up to 4 weeks)',p:'69 €'},
  ]},
  {id:'permanent',de:'Permanent Make-up',ru:'Перманентный макияж',en:'Permanent Make-up',items:[
    {de:'Powder Brows',ru:'Пудровые брови (Powder Brows)',en:'Powder Brows',p:'230 €'},
    {de:'Nachstechen in 5 Wochen (Brows)',ru:'Брови - Коррекция (через 5 нед.)',en:'Brows - Touch up (in 5 weeks)',p:'75 €'},
    {de:'Lippen',ru:'Губы',en:'Lips',p:'280 €'},
    {de:'Nachstechen in 5 Wochen (Lippen)',ru:'Губы - Коррекция (через 5 нед.)',en:'Lips - Touch up (in 5 weeks)',p:'90 €'},
    {de:'Lidstrich',ru:'Стрелки',en:'Eyeliner',p:'180 €'},
    {de:'Nachstechen in 5 Wochen (Lidstrich)',ru:'Стрелки - Коррекция (через 5 нед.)',en:'Eyeliner - Touch up (in 5 weeks)',p:'70 €'},
  ]},
  {id:'waxing',de:'Waxing & Haarentfernung',ru:'Депиляция (Воск)',en:'Waxing',items:[
    {de:'Oberlippe, 10 Min.',ru:'Верхняя губа, 10 мин.',en:'Upper lip, 10 min.',p:'14 €'},
    {de:'Kinn, 10 Min.',ru:'Подбородок, 10 мин.',en:'Chin, 10 min.',p:'16 €'},
    {de:'Oberlippe & Kinn, 15 Min.',ru:'Верхняя губа и подбородок, 15 мин.',en:'Upper lip & chin, 15 min.',p:'22 €'},
    {de:'Wange, 10 Min.',ru:'Щеки, 10 мин.',en:'Cheeks, 10 min.',p:'22 €'},
    {de:'Hals, 10 Min.',ru:'Шея, 10 мин.',en:'Neck, 10 min.',p:'28 €'},
    {de:'Nase, 5 Min.',ru:'Нос, 5 мин.',en:'Nose, 5 min.',p:'12 €'},
    {de:'Ohren, 5 Min.',ru:'Уши, 5 мин.',en:'Ears, 5 min.',p:'12 €'},
    {de:'Gesicht komplett, 25 Min.',ru:'Лицо полностью, 25 мин.',en:'Full face, 25 min.',p:'44 €'},
    {de:'Nacken, 10 Min.',ru:'Затылок (шея сзади), 10 мин.',en:'Nape, 10 min.',p:'28 €'},
    {de:'Achseln, 10 Min.',ru:'Подмышки, 10 мин.',en:'Underarms, 10 min.',p:'28 €'},
    {de:'Unterarme, 20 Min.',ru:'Предплечья, 20 мин.',en:'Forearms, 20 min.',p:'32 €'},
    {de:'Oberarme, 25 Min.',ru:'Плечи, 25 мин.',en:'Upper arms, 25 min.',p:'38 €'},
    {de:'Arme komplett, 40 Min.',ru:'Руки полностью, 40 мин.',en:'Full arms, 40 min.',p:'65 €'},
    {de:'Arme komplett mit Achseln, 45 Min.',ru:'Руки и подмышки, 45 мин.',en:'Full arms & underarms, 45 min.',p:'75 €'},
    {de:'Unterschenkel inkl. Knie, 30 Min.',ru:'Голени вкл. колени, 30 мин.',en:'Lower legs incl. knees, 30 min.',p:'40 €'},
    {de:'Oberschenkel, 30 Min.',ru:'Бедра, 30 мин.',en:'Upper legs, 30 min.',p:'45 €'},
    {de:'Beine komplett, 45 Min.',ru:'Ноги полностью, 45 мин.',en:'Full legs, 45 min.',p:'70 €'},
    {de:'Rücken unten, 15 Min.',ru:'Спина (низ), 15 мин.',en:'Lower back, 15 min.',p:'28 €'},
    {de:'Rücken oben, 25 Min.',ru:'Спина (верх), 25 мин.',en:'Upper back, 25 min.',p:'35 €'},
    {de:'Rücken komplett, 35 Min.',ru:'Спина полностью, 35 мин.',en:'Full back, 35 min.',p:'58 €'},
    {de:'Schulter, 20 Min.',ru:'Плечи, 20 мин.',en:'Shoulders, 20 min.',p:'30 €'},
    {de:'Brust, 20 Min.',ru:'Грудь, 20 мин.',en:'Chest, 20 min.',p:'30 €'},
    {de:'Bauch, 25 Min.',ru:'Живот, 25 мин.',en:'Stomach, 25 min.',p:'35 €'},
    {de:'Bikinilinie (Grenze Obersch.), 15 Min.',ru:'Зона бикини, 15 мин.',en:'Bikini line, 15 min.',p:'30 €'},
    {de:'Intim inkl. Pofalte, 30-45 Min.',ru:'Бикини (вкл. межяг. складку), 30-45 мин.',en:'Brazilian incl. gluteal cleft, 30-45 min.',p:'ab 60 €'},
    {de:'Intim ohne Pofalte, 30 Min.',ru:'Бикини (без межяг. складки), 30 мин.',en:'Brazilian excl. gluteal cleft, 30 min.',p:'ab 55 €'},
    {de:'Nur Pofalte, 10 Min.',ru:'Только межягодичная складка, 10 мин.',en:'Gluteal cleft only, 10 min.',p:'ab 25 €'},
    {de:'Pobacken, 15 Min.',ru:'Ягодицы, 15 мин.',en:'Buttocks, 15 min.',p:'40 €'},
  ]}
];

const galleryCategories = [
  {id:'nails',de:'Nägel',ru:'Ногти',en:'Nails',images:[
    {src:'assets/images/gallery/nails/nails-1.jpg'},
    {src:'assets/images/gallery/nails/nails-2.jpg'},
    {src:'assets/images/gallery/nails/nails-3.jpg'},
    {src:'assets/images/gallery/nails/nails-4.jpg'},
    {src:'assets/images/gallery/nails/nails-5.jpg'},
    {src:'assets/images/gallery/nails/nails-6.JPG'},
    {src:'assets/images/gallery/nails/nails-7.jpg'},
    {src:'assets/images/gallery/nails/nails-8.jpg'},
  ]},
  {id:'brows',de:'Brauen',ru:'Брови',en:'Brows',images:[
    {src:'assets/images/gallery/brows/brows-1.jpg'},
    {src:'assets/images/gallery/brows/brows-2.jpg'},
    {src:'assets/images/gallery/brows/brows-3.jpg'},
  ]},
  {id:'lashes',de:'Wimpern',ru:'Ресницы',en:'Lashes',images:[
    {src:'assets/images/gallery/lashes/lashes-1.jpg'},
    {src:'assets/images/gallery/lashes/lashes-2.jpg'},
    {src:'assets/images/gallery/lashes/lashes-3.jpg'},
    {src:'assets/images/gallery/lashes/lashes-4.jpg'},
  ]},
  {id:'pedicure',de:'Pediküre',ru:'Педикюр',en:'Pedicure',images:[
    {src:'assets/images/gallery/feet/feet-1.jpg'},
    {src:'assets/images/gallery/feet/feet-2.jpg'},
    {src:'assets/images/gallery/feet/feet-3.jpg'},
  ]},
  {id:'permanent',de:'Permanent',ru:'Перманент',en:'Permanent',images:[
    {src:'assets/images/gallery/lips/lips-1.jpg'},
    {src:'assets/images/gallery/lips/lips-2.jpg'},
    {src:'assets/images/gallery/lips/lips-3.jpg'},
  ]}
];

const reviews = [
  {name:'Maria S.',de:'Anna ist unglaublich talentiert! Meine Nägel sehen jedes Mal perfekt aus. Der Salon ist wunderschön und die Atmosphäre sehr entspannt.',ru:'Анна невероятно талантлива! Мои ногти каждый раз выглядят идеально. Салон красивый, а атмосфера очень расслабляющая.',en:'Anna is incredibly talented! My nails look perfect every time. The salon is beautiful and the atmosphere very relaxing.'},
  {name:'Elena K.',de:'Die beste Meisterin in Kassel! Ich komme seit 3 Jahren zu Anna und war nie enttäuscht. Ihr Permanent Make-up ist einfach Kunst.',ru:'Лучший мастер в Касселе! Я хожу к Анне уже 3 года и ни разу не была разочарована. Её перманентный макияж — это просто искусство.',en:'The best master in Kassel! I\'ve been coming to Anna for 3 years and was never disappointed. Her permanent make-up is simply art.'},
  {name:'Olga M.',de:'Professionell, freundlich und immer pünktlich. Meine Wimpernverlängerung hält ewig und sieht so natürlich aus. Absolute Empfehlung!',ru:'Профессионально, дружелюбно и всегда пунктуально. Мои нарощенные ресницы держатся вечно и выглядят так натурально. Абсолютная рекомендация!',en:'Professional, friendly and always punctual. My lash extensions last forever and look so natural. Absolute recommendation!'},
];

const faqs = [
  {q:{de:'Wie kann ich meinen Termin absagen oder verschieben?',ru:'Как я могу отменить или перенести запись?',en:'How can I cancel or reschedule my appointment?'},
   a:{de:'Bitte informieren Sie uns mindestens 24 Stunden im Voraus per Telefon oder Nachricht. Bei sehr kurzfristigen Absagen müssen wir leider 50% des Behandlungspreises in Rechnung stellen.',ru:'Пожалуйста, сообщите нам как минимум за 24 часа. При очень поздней отмене мы будем вынуждены удержать 50% от стоимости процедуры.',en:'Please inform us at least 24 hours in advance. For very late cancellations, we unfortunately have to charge 50% of the treatment price.'}},
  {q:{de:'Welche Zahlungsmöglichkeiten bieten Sie an?',ru:'Какие формы оплаты вы принимаете?',en:'Which payment methods do you accept?'},
   a:{de:'Wir akzeptieren Barzahlung und PayPal. Eine Kartenzahlung ist leider nicht möglich.',ru:'Мы принимаем наличные и PayPal. Оплата картой, к сожалению, не доступна.',en:'We accept cash and PayPal. Card payments are unfortunately not available.'}},
  {q:{de:'Bieten Sie auch Geschenkgutscheine an?',ru:'Можно ли приобрести подарочные сертификаты?',en:'Do you offer gift certificates?'},
   a:{de:'Ja, wir bieten wunderschön verpackte Geschenkgutscheine für jeden beliebigen Betrag an. Sie können diese direkt im Salon erwerben.',ru:'Да, мы предлагаем красиво упакованные подарочные сертификаты на любую сумму. Их можно приобрести прямо в салоне.',en:'Yes, we offer beautifully packaged gift certificates for any amount. You can purchase them directly in the salon.'}},
  {q:{de:'Wie bereite ich mich am besten auf das Waxing vor?',ru:'Как лучше подготовиться к ваксингу?',en:'How should I prepare for waxing?'},
   a:{de:'Das Haar sollte für ein optimales Ergebnis etwa 4-5 mm lang sein. Vermeiden Sie 24 Stunden vorher direkte Sonneneinstrahlung und benutzen Sie am Tag keine Körperöle an den entsprechenden Stellen.',ru:'Для идеального результата длина волосков должна быть около 4-5 мм. Избегайте солнца за 24 часа и не наносите масла на тело в день депиляции.',en:'For optimal results, hair should be about 4-5 mm long. Avoid direct sunlight 24 hours beforehand and do not use body oils on that day.'}},
];

/* ============ BUILD ============ */
function buildAccordion(){
  const c=document.getElementById('accordionContainer');
  services.forEach((s,i)=>{
    const div=document.createElement('div');
    div.className='reveal stagger-'+(i%4+1)+' bg-cream-dark/40 rounded-2xl overflow-hidden hover-lift';
    let inner='';
    if(s.hasTabs){
      inner=`<div class="px-6 pt-4 flex gap-4">
        <button class="sub-tab active font-body text-sm font-bold pb-1" onclick="switchTab(this,'${s.id}','damen')" data-de="${s.tabs.damen.de}" data-ru="${s.tabs.damen.ru}" data-en="${s.tabs.damen.en}">${s.tabs.damen[currentLang]}</button>
        <button class="sub-tab font-body text-sm font-bold pb-1 text-espresso/50" onclick="switchTab(this,'${s.id}','herren')" data-de="${s.tabs.herren.de}" data-ru="${s.tabs.herren.ru}" data-en="${s.tabs.herren.en}">${s.tabs.herren[currentLang]}</button>
      </div>`;
      for(const tk of ['damen','herren']){
        inner+=`<div class="tab-panel-${s.id}" data-tab="${tk}" style="display:${tk==='damen'?'block':'none'}">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 px-6 pb-6 pt-3">
            ${s.tabs[tk].items.map(it=>`<div class="flex justify-between py-1.5 border-b border-cream-dark/50"><span class="font-body text-sm" data-de="${it.de}" data-ru="${it.ru}" data-en="${it.en}">${it[currentLang]}</span><span class="font-body text-sm font-bold text-rose whitespace-nowrap ml-4">${it.p}</span></div>`).join('')}
          </div></div>`;
      }
    } else {
      inner=`<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 px-6 pb-6 pt-1">
        ${s.items.map(it=>`<div class="flex justify-between py-1.5 border-b border-cream-dark/50"><span class="font-body text-sm" data-de="${it.de}" data-ru="${it.ru}" data-en="${it.en}">${it[currentLang]}</span><span class="font-body text-sm font-bold text-rose whitespace-nowrap ml-4">${it.p}</span></div>`).join('')}
      </div>`;
    }
    div.innerHTML=`<button class="w-full flex items-center justify-between px-6 py-5 text-left" onclick="toggleAccordion(this)">
        <span class="font-heading text-xl text-espresso" data-de="${s.de}" data-ru="${s.ru}" data-en="${s.en}">${s[currentLang]}</span>
        <span class="accordion-icon text-rose text-2xl font-light leading-none select-none">+</span>
      </button><div class="accordion-body"><div>${inner}</div></div>`;
    c.appendChild(div);
  });
}

function buildGallery(){
  const pillsC=document.getElementById('categoryPills');
  const panelsC=document.getElementById('galleryPanels');
  galleryCategories.forEach((cat,ci)=>{
    const pill=document.createElement('button');
    pill.className=`cat-pill font-body text-sm font-medium px-5 py-2 rounded-full ${ci===0?'active':''}`;
    pill.dataset.cat=cat.id;
    pill.setAttribute('data-de',cat.de);pill.setAttribute('data-ru',cat.ru);pill.setAttribute('data-en',cat.en);
    pill.textContent=cat[currentLang];
    pill.onclick=()=>switchCategory(cat.id);
    pillsC.appendChild(pill);

    const panel=document.createElement('div');
    panel.className=`cat-panel ${ci===0?'active':''}`;
    panel.dataset.catPanel=cat.id;
    const cId=`carousel-${cat.id}`;
    let cards=cat.images.map(img=>{
      const content=img.src
        ?`<img src="${img.src}" alt="${cat[currentLang]}" loading="lazy" decoding="async" class="w-full h-full object-cover">`
        :`<div class="w-full h-full bg-cream"></div>`;
      return `<div class="carousel-card w-[260px] md:w-[300px] flex-shrink-0" onclick="openLightbox(this)" data-src="${img.src||''}">
        <div class="relative rounded-2xl overflow-hidden aspect-square gallery-item shadow-md">
          ${content}
        </div></div>`;
    }).join('');
    
    // Center alignment mechanism if few photos
    // Assume container max-width 6xl = ~1152px. Each card is 300 + 16px gap = 316px. 
    // If <= 3 images, they easily fit exactly and center on large screens.
    const centerClass = cat.images.length <= 3 ? 'md:justify-center' : '';
    
    panel.innerHTML=`<div class="relative">
        <div class="flex items-center gap-3 mb-4">
          <h3 class="font-heading text-2xl text-espresso" data-de="${cat.de}" data-ru="${cat.ru}" data-en="${cat.en}">${cat[currentLang]}</h3>
          <div class="flex-1"></div>
          <button class="carousel-arrow" onclick="scrollCarousel('${cId}',-1)">‹</button>
          <button class="carousel-arrow" onclick="scrollCarousel('${cId}',1)">›</button>
        </div>
        <div class="carousel-track ${centerClass}" id="${cId}">${cards}</div>
      </div>`;
    panelsC.appendChild(panel);
  });
}

function buildReviews(){
  const r=document.getElementById('reviewsGrid');
  reviews.forEach((rev,i)=>{
    r.innerHTML+=`<div class="reveal stagger-${i+1} bg-cream-dark/40 rounded-2xl p-6 hover-lift">
      <div class="flex gap-0.5 mb-3">${'<span class="star text-lg">★</span>'.repeat(5)}</div>
      <p class="font-body text-sm text-espresso/70 leading-relaxed mb-4" data-de="${rev.de}" data-ru="${rev.ru}" data-en="${rev.en}">${rev[currentLang]}</p>
      <p class="font-body text-sm font-bold text-espresso">— ${rev.name}</p>
    </div>`;
  });
}

function buildFaq(){
  const c = document.getElementById('faqContainer');
  faqs.forEach((item, i) => {
    const div = document.createElement('div');
    // Solid background, soft border, to match screenshot
    div.className = `reveal stagger-${i%4+1} bg-[#F4EBE2] rounded-[24px] overflow-hidden`;
    div.innerHTML = `<button class="w-full flex items-center justify-between px-6 py-5 text-left" onclick="toggleAccordion(this)">
        <span class="font-body font-bold text-sm text-espresso pr-4" data-de="${item.q.de}" data-ru="${item.q.ru}" data-en="${item.q.en}">${item.q[currentLang]}</span>
        <span class="accordion-icon text-[#C89582] text-2xl font-light leading-none select-none transition-transform duration-300">+</span>
      </button>
      <div class="accordion-body">
        <div>
          <div class="px-6 pb-6 pt-1 font-body text-sm text-espresso/80 leading-relaxed" data-de="${item.a.de}" data-ru="${item.a.ru}" data-en="${item.a.en}">${item.a[currentLang]}</div>
        </div>
      </div>`;
    c.appendChild(div);
  });
}

/* ============ DB PROCEDURES — Dynamic load ============ */
let dbProcedures = null;

async function loadProceduresFromDB() {
  try {
    ensureSDKs();
    if (!supabaseClient) throw new Error('No client');
    const { data, error } = await supabaseClient
      .from('procedures')
      .select('*')
      .order('category_sort').order('subcategory_sort').order('sort_order');
    if (!error && data && data.length > 0) dbProcedures = data;
  } catch(e) { console.warn('Procedures DB error, using fallback', e); }
  buildAccordionFromDB();
  buildServiceCards();
}

function buildAccordionFromDB() {
  const c = document.getElementById('accordionContainer');
  if (!c) return;
  if (!dbProcedures) { buildAccordion(); return; }
  c.innerHTML = '';
  const catMap = new Map();
  dbProcedures.forEach(p => {
    if (!catMap.has(p.category_id)) catMap.set(p.category_id, { meta: p, subs: new Map() });
    const cat = catMap.get(p.category_id);
    const subKey = p.subcategory_id || '__flat__';
    if (!cat.subs.has(subKey)) cat.subs.set(subKey, { meta: p, items: [] });
    cat.subs.get(subKey).items.push(p);
  });
  let i = 0;
  catMap.forEach((cat) => {
    let inner = '';
    cat.subs.forEach((sub, subKey) => {
      const rows = sub.items.map(it =>
        `<div class="flex justify-between py-1.5 border-b border-cream-dark/50"><span class="font-body text-sm">${it['name_' + currentLang] || it.name_de}</span><span class="font-body text-sm font-bold text-rose whitespace-nowrap ml-4">${it.price}</span></div>`
      ).join('');
      if (subKey === '__flat__') {
        inner += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 px-6 pb-6 pt-1">${rows}</div>`;
      } else {
        const subLabel = sub.meta['subcategory_' + currentLang] || sub.meta.subcategory_de || '';
        inner += `<div class="px-6 pt-4 pb-1 font-body text-xs font-bold text-rose/70 uppercase tracking-wider">${subLabel}</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 px-6 pb-4">${rows}</div>`;
      }
    });
    const catLabel = cat.meta['category_' + currentLang] || cat.meta.category_de;
    const div = document.createElement('div');
    div.className = `reveal stagger-${i%4+1} bg-cream-dark/40 rounded-2xl overflow-hidden hover-lift`;
    div.innerHTML = `<button class="w-full flex items-center justify-between px-6 py-5 text-left" onclick="toggleAccordion(this)"><span class="font-heading text-xl text-espresso">${catLabel}</span><span class="accordion-icon text-rose text-2xl font-light leading-none select-none">+</span></button><div class="accordion-body"><div>${inner}</div></div>`;
    c.appendChild(div);
    i++;
  });
}

function buildServiceSelect(){
  const sel=document.getElementById('serviceSelect');
  const defTexts={de:'Behandlung wählen',ru:'Выберите услугу',en:'Choose service'};
  const opt0=document.createElement('option');
  opt0.value='';opt0.textContent=defTexts[currentLang];
  opt0.setAttribute('data-de',defTexts.de);opt0.setAttribute('data-ru',defTexts.ru);opt0.setAttribute('data-en',defTexts.en);
  sel.appendChild(opt0);
  services.forEach(s=>{
    const o=document.createElement('option');
    o.value=s.id;o.textContent=s[currentLang];
    o.setAttribute('data-de',s.de);o.setAttribute('data-ru',s.ru);o.setAttribute('data-en',s.en);
    sel.appendChild(o);
  });
}

/* ============ INTERACTIONS ============ */
function toggleAccordion(btn){
  const body=btn.nextElementSibling,icon=btn.querySelector('.accordion-icon'),isOpen=body.classList.contains('open');
  document.querySelectorAll('.accordion-body.open').forEach(b=>{b.classList.remove('open');b.previousElementSibling.querySelector('.accordion-icon').classList.remove('rotated')});
  if(!isOpen){body.classList.add('open');icon.classList.add('rotated')}
}
function switchTab(btn,sId,tabKey){
  btn.parentElement.querySelectorAll('.sub-tab').forEach(t=>{t.classList.remove('active');t.classList.add('text-espresso/50')});
  btn.classList.add('active');btn.classList.remove('text-espresso/50');
  document.querySelectorAll(`.tab-panel-${sId}`).forEach(p=>{p.style.display=p.dataset.tab===tabKey?'block':'none'});
}
function switchCategory(catId){
  activeCategory=catId;
  document.querySelectorAll('.cat-pill').forEach(p=>p.classList.remove('active'));
  document.querySelector(`.cat-pill[data-cat="${catId}"]`).classList.add('active');
  document.querySelectorAll('.cat-panel').forEach(p=>{p.classList.toggle('active',p.dataset.catPanel===catId)});
}
function scrollCarousel(id,dir){
  const track=document.getElementById(id);
  track.scrollBy({left:dir*(track.querySelector('.carousel-card').offsetWidth+16),behavior:'smooth'});
}
function openLightbox(card){
  const lb=document.getElementById('lightbox'),inner=document.getElementById('lightboxInner'),src=card.dataset.src,grad=card.dataset.grad;
  inner.innerHTML=src
    ?`<img src="${src}" alt="" class="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl">`
    :`<div class="w-[80vw] max-w-lg aspect-[3/4] rounded-2xl bg-gradient-to-br ${grad} shadow-2xl"></div>`;
  lb.classList.add('active');
}
function closeLightbox(e){if(e&&e.target!==e.currentTarget&&!e.target.closest('button'))return;document.getElementById('lightbox').classList.remove('active')}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('lightbox').classList.remove('active')});


const sysMessages = {
  de: {
    slotTaken: "Dieses Zeitfenster ist bereits gebucht. Bitte wählen Sie eine andere Uhrzeit.",
    error: "Fehler bei der Buchung. Bitte versuchen Sie es erneut.",
    fillAll: "Bitte alle Felder ausfüllen",
    invalidEmail: "Ungültige E-Mail",
    pickTime: "Bitte Uhrzeit wählen",
    pickDate: "Bitte Datum wählen",
    checkError: "Fehler bei der Prüfung. Bitte versuchen Sie es erneut."
  },
  ru: {
    slotTaken: "Это время уже занято. Выберите другое.",
    error: "Ошибка при записи. Попробуйте еще раз.",
    fillAll: "Пожалуйста, заполните все поля",
    invalidEmail: "Неверный Email",
    pickTime: "Выберите время",
    pickDate: "Выберите дату",
    checkError: "Ошибка проверки. Попробуйте еще раз."
  },
  en: {
    slotTaken: "This time slot is already booked. Please choose another.",
    error: "Booking error. Please try again.",
    fillAll: "Please fill in all fields",
    invalidEmail: "Invalid Email",
    pickTime: "Please select a time",
    pickDate: "Please select a date",
    checkError: "Validation error. Please try again."
  }
};

/* ============ BOOKING: TOAST ============ */
function showToast(message, type = 'error') {
  const wrap = document.getElementById('toastWrap');
  const div = document.createElement('div');
  div.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✓' : '!';
  div.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  wrap.appendChild(div);
  requestAnimationFrame(() => { requestAnimationFrame(() => { div.classList.add('show'); }); });
  setTimeout(() => {
    div.classList.remove('show');
    setTimeout(() => div.remove(), 400);
  }, 3800);
}
function showNotification(message) { showToast(message, 'error'); }


/* ============ BOOKING: SERVICE DATA & PICKER ============ */
const bookingCategories = [
  {id:'permanent', de:'Permanent Make-up', ru:'Перманентный макияж', en:'Permanent Make-up', icon:'✦',
    subs:[
      {id:'pm-brows', de:'Augenbrauen', ru:'Брови', en:'Eyebrows', items:[
        {de:'Powder Brows', ru:'Пудровые брови', en:'Powder Brows', p:'230 €'},
        {de:'Nachstechen in 5 Wochen', ru:'Коррекция через 5 нед.', en:'Touch-up in 5 weeks', p:'75 €'},
      ]},
      {id:'pm-lips', de:'Lippen', ru:'Губы', en:'Lips', items:[
        {de:'Lippen', ru:'Губы', en:'Lips', p:'280 €'},
        {de:'Nachstechen in 5 Wochen', ru:'Коррекция через 5 нед.', en:'Touch-up in 5 weeks', p:'90 €'},
      ]},
      {id:'pm-liner', de:'Lidstrich', ru:'Стрелки', en:'Eyeliner', items:[
        {de:'Lidstrich', ru:'Стрелки', en:'Eyeliner', p:'180 €'},
        {de:'Nachstechen in 5 Wochen', ru:'Коррекция через 5 нед.', en:'Touch-up in 5 weeks', p:'70 €'},
      ]},
    ]
  },
  {id:'lashes-ext', de:'Wimpernverlängerung', ru:'Наращивание ресниц', en:'Lash Extensions', icon:'✦',
    subs:[
      {id:'lash-classic', de:'Naturlashes / Classic 1:1', ru:'Классика 1:1', en:'Classic 1:1', items:[
        {de:'Neu', ru:'Новый комплект', en:'New set', p:'79 €'},
        {de:'Auffüllung bis 2 Wochen', ru:'Коррекция до 2 нед.', en:'Refill up to 2 weeks', p:'39 €'},
        {de:'Auffüllung bis 3 Wochen', ru:'Коррекция до 3 нед.', en:'Refill up to 3 weeks', p:'49 €'},
        {de:'Auffüllung bis 4 Wochen', ru:'Коррекция до 4 нед.', en:'Refill up to 4 weeks', p:'59 €'},
      ]},
      {id:'lash-volume', de:'Mascara Look 2-3D', ru:'Объём 2-3D', en:'Volume 2-3D', items:[
        {de:'Neu', ru:'Новый комплект', en:'New set', p:'89 €'},
        {de:'Auffüllung bis 2 Wochen', ru:'Коррекция до 2 нед.', en:'Refill up to 2 weeks', p:'40 €'},
        {de:'Auffüllung bis 3 Wochen', ru:'Коррекция до 3 нед.', en:'Refill up to 3 weeks', p:'59 €'},
        {de:'Auffüllung bis 4 Wochen', ru:'Коррекция до 4 нед.', en:'Refill up to 4 weeks', p:'69 €'},
      ]},
    ]
  },
  {id:'lifting', de:'Lifting', ru:'Лифтинг', en:'Lifting', icon:'✦',
    items:[
      {de:'Wimpernlifting mit färben', ru:'Лифтинг ресниц с окрашиванием', en:'Lash lift with tint', p:'70 €'},
      {de:'Augenbrauenlifting mit färben', ru:'Лифтинг бровей с окрашиванием', en:'Brow lift with tint', p:'75 €'},
      {de:'Augenbrauen färben mit Henna', ru:'Окрашивание бровей хной', en:'Brow tint with henna', p:'40 €'},
      {de:'Wimper färben', ru:'Окрашивание ресниц', en:'Lash tint', p:'15 €'},
      {de:'Augenbrauen färben', ru:'Окрашивание бровей', en:'Brow tint', p:'15 €'},
      {de:'Augenbrauen zupfen', ru:'Коррекция бровей', en:'Brow plucking', p:'15 €'},
    ]
  },
  {id:'nails', de:'Gel Nails', ru:'Гелевые ногти', en:'Gel Nails', icon:'✦',
    subs:[
      {id:'nail-new', de:'Neumodellage', ru:'Новое наращивание', en:'New set', items:[
        {de:'Natur', ru:'Натуральный', en:'Natural', p:'50 €'},
        {de:'Farben', ru:'Цветной', en:'Colour', p:'59 €'},
        {de:'French / Babyboomer', ru:'Френч / Бэбибумер', en:'French / Babyboomer', p:'69 €'},
      ]},
      {id:'nail-refill', de:'Auffüllen', ru:'Коррекция', en:'Refill', items:[
        {de:'Natur', ru:'Натуральный', en:'Natural', p:'44 €'},
        {de:'Farben', ru:'Цветной', en:'Colour', p:'49 €'},
        {de:'French / Babyboomer', ru:'Френч / Бэбибумер', en:'French / Babyboomer', p:'55 €'},
      ]},
      {id:'nail-mani', de:'Maniküre', ru:'Маникюр', en:'Manicure', items:[
        {de:'Classic ohne Lack', ru:'Классический без лака', en:'Classic without polish', p:'30 €'},
        {de:'Mit Lack', ru:'С лаком', en:'With polish', p:'40 €'},
      ]},
    ]
  },
  {id:'pedicure', de:'Fußpflege', ru:'Педикюр', en:'Pedicure', icon:'✦',
    items:[
      {de:'Fußpflege Classic', ru:'Классический педикюр', en:'Classic pedicure', p:'38 €'},
      {de:'Fußpflege mit Lack', ru:'Педикюр с лаком', en:'Pedicure with polish', p:'43 €'},
      {de:'Fußpflege mit Gellack', ru:'Педикюр с гель-лаком', en:'Pedicure with gel polish', p:'55 €'},
    ]
  },
  {id:'spa-pedicure', de:'SPA Fußpflege', ru:'SPA педикюр', en:'SPA Pedicure', icon:'✦',
    subs:[
      {id:'spa-base-1', de:'Nur SPA Fußpflege', ru:'Только SPA педикюр', en:'Only SPA pedicure', items:[
        {de:'Ohne Extra', ru:'Без доп. услуг', en:'No extra', p:'48 €'},
        {de:'+ Nail-Art', ru:'+ Нейл-арт', en:'+ Nail art', p:'51 €'},
        {de:'+ Strasssteine', ru:'+ Стразы', en:'+ Rhinestones', p:'50 €'},
        {de:'+ French / Babyboomer', ru:'+ Френч / Бэбибумер', en:'+ French / Babyboomer', p:'58 €'}
      ]},
      {id:'spa-base-2', de:'SPA Fußpflege mit Lack', ru:'SPA педикюр с лаком', en:'SPA pedicure with polish', items:[
        {de:'Ohne Extra', ru:'Без доп. услуг', en:'No extra', p:'53 €'},
        {de:'+ Nail-Art', ru:'+ Нейл-арт', en:'+ Nail art', p:'56 €'},
        {de:'+ Strasssteine', ru:'+ Стразы', en:'+ Rhinestones', p:'55 €'},
        {de:'+ French / Babyboomer', ru:'+ Френч / Бэбибумер', en:'+ French / Babyboomer', p:'63 €'}
      ]},
      {id:'spa-base-3', de:'SPA Fußpflege mit Gellack', ru:'SPA педикюр с гель-лаком', en:'SPA pedicure with gel polish', items:[
        {de:'Ohne Extra', ru:'Без доп. услуг', en:'No extra', p:'65 €'},
        {de:'+ Nail-Art', ru:'+ Нейл-арт', en:'+ Nail art', p:'68 €'},
        {de:'+ Strasssteine', ru:'+ Стразы', en:'+ Rhinestones', p:'67 €'},
        {de:'+ French / Babyboomer', ru:'+ Френч / Бэбибумер', en:'+ French / Babyboomer', p:'75 €'}
      ]}
    ]
  },
  {id:'waxing', de:'Waxing', ru:'Ваксинг', en:'Waxing', icon:'✦',
    items:[
      {de:'Oberlippe', ru:'Верхняя губа', en:'Upper lip', p:'14 €'},
      {de:'Kinn', ru:'Подбородок', en:'Chin', p:'16 €'},
      {de:'Oberlippe & Kinn', ru:'Верхняя губа и подбородок', en:'Upper lip & chin', p:'22 €'},
      {de:'Wange', ru:'Щеки', en:'Cheeks', p:'22 €'},
      {de:'Hals', ru:'Шея', en:'Neck', p:'28 €'},
      {de:'Nase', ru:'Нос', en:'Nose', p:'12 €'},
      {de:'Ohren', ru:'Уши', en:'Ears', p:'12 €'},
      {de:'Gesicht komplett', ru:'Лицо полностью', en:'Full face', p:'44 €'},
      {de:'Nacken', ru:'Затылок', en:'Nape', p:'28 €'},
      {de:'Achseln', ru:'Подмышки', en:'Underarms', p:'28 €'},
      {de:'Unterarme', ru:'Предплечья', en:'Forearms', p:'32 €'},
      {de:'Oberarme', ru:'Плечи', en:'Upper arms', p:'38 €'},
      {de:'Arme komplett', ru:'Руки полностью', en:'Full arms', p:'65 €'},
      {de:'Unterschenkel inkl. Knie', ru:'Голени вкл. колени', en:'Lower legs', p:'40 €'},
      {de:'Oberschenkel', ru:'Бедра', en:'Upper legs', p:'45 €'},
      {de:'Beine komplett', ru:'Ноги полностью', en:'Full legs', p:'70 €'},
      {de:'Rücken unten', ru:'Спина (низ)', en:'Lower back', p:'28 €'},
      {de:'Rücken oben', ru:'Спина (верх)', en:'Upper back', p:'35 €'},
      {de:'Rücken komplett', ru:'Спина полностью', en:'Full back', p:'58 €'},
      {de:'Bikinilinie', ru:'Зона бикини', en:'Bikini line', p:'30 €'},
      {de:'Intim inkl. Pofalte', ru:'Бикини глубокое', en:'Brazilian incl. gluteal cleft', p:'ab 60 €'},
      {de:'Intim ohne Pofalte', ru:'Бикини (без межяг. складки)', en:'Brazilian excl. gluteal cleft', p:'ab 55 €'},
      {de:'Pobacken', ru:'Ягодицы', en:'Buttocks', p:'40 €'},
    ]
  }
];

let selectedServiceId = null;
let selectedServiceName = null;
let selectedServicePrice = null;

function buildServiceCards() {
  const wrap = document.getElementById('svcPickerWrap');
  if (!wrap) return;
  if (dbProcedures) {
    renderCategoryGridFromDB(wrap);
  } else {
    renderCategoryGrid(wrap);
  }
}

function renderCategoryGridFromDB(wrap) {
  wrap.innerHTML = '';
  // Only show_in_booking items, grouped by category then subcategory
  const procs = dbProcedures.filter(p => p.show_in_booking);
  const catMap = new Map();
  procs.forEach(p => {
    if (!catMap.has(p.category_id)) catMap.set(p.category_id, { meta: p, subs: new Map() });
    const cat = catMap.get(p.category_id);
    const subKey = p.subcategory_id || '__flat__';
    if (!cat.subs.has(subKey)) cat.subs.set(subKey, { meta: p, items: [] });
    cat.subs.get(subKey).items.push(p);
  });
  // Convert to bookingCategories-compatible format and render
  const dynCats = [];
  catMap.forEach((cat, catId) => {
    const catObj = { id: catId, de: cat.meta.category_de, ru: cat.meta.category_ru, en: cat.meta.category_en, icon: '✦' };
    if (cat.subs.size === 1 && cat.subs.has('__flat__')) {
      catObj.items = cat.subs.get('__flat__').items.map(p => ({ de: p.name_de, ru: p.name_ru, en: p.name_en, p: p.price }));
    } else {
      catObj.subs = [];
      cat.subs.forEach((sub, subKey) => {
        if (subKey === '__flat__') return;
        catObj.subs.push({ id: subKey, de: sub.meta.subcategory_de, ru: sub.meta.subcategory_ru, en: sub.meta.subcategory_en,
          items: sub.items.map(p => ({ de: p.name_de, ru: p.name_ru, en: p.name_en, p: p.price })) });
      });
      // also handle if there are flat items alongside subs
      if (cat.subs.has('__flat__')) {
        catObj.subs.unshift({ id: '__other__', de: 'Sonstige', ru: 'Прочее', en: 'Other',
          items: cat.subs.get('__flat__').items.map(p => ({ de: p.name_de, ru: p.name_ru, en: p.name_en, p: p.price })) });
      }
      if (catObj.subs.length === 0) { catObj.items = []; }
    }
    dynCats.push(catObj);
  });
  // Temporarily override bookingCategories for renderCategoryGrid
  const _orig = bookingCategories.splice(0, bookingCategories.length, ...dynCats);
  renderCategoryGrid(wrap);
  bookingCategories.splice(0, bookingCategories.length, ..._orig);
}


function renderCategoryGrid(wrap) {
  wrap.innerHTML = '';
  const panel = document.createElement('div');
  const grid = document.createElement('div');
  grid.className = 'service-cards-grid';
  bookingCategories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'service-card';
    btn.setAttribute('data-de', cat.de);
    btn.setAttribute('data-ru', cat.ru);
    btn.setAttribute('data-en', cat.en);
    btn.innerHTML = `<span>${cat[currentLang]}</span>`;
    btn.onclick = () => {
      if (cat.subs) {
        renderSubcategories(wrap, cat);
      } else {
        renderServiceList(wrap, cat, cat.items, cat);
      }
    };
    grid.appendChild(btn);
  });
  panel.appendChild(grid);
  showPanel(wrap, panel);
}

function renderSubcategories(wrap, cat) {
  wrap.innerHTML = '';
  const panel = document.createElement('div');
  // Back button
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'svc-back';
  back.innerHTML = `← <span data-de="Zurück" data-ru="Назад" data-en="Back">${{de:'Zurück',ru:'Назад',en:'Back'}[currentLang]}</span>`;
  back.onclick = () => renderCategoryGrid(wrap);
  panel.appendChild(back);
  // Breadcrumb
  const bc = document.createElement('div');
  bc.className = 'svc-breadcrumb';
  bc.textContent = cat[currentLang];
  panel.appendChild(bc);
  // Grid
  const grid = document.createElement('div');
  grid.className = 'service-cards-grid';
  cat.subs.forEach(sub => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'service-card';
    btn.setAttribute('data-de', sub.de);
    btn.setAttribute('data-ru', sub.ru);
    btn.setAttribute('data-en', sub.en);
    btn.innerHTML = `<span>${sub[currentLang]}</span>`;
    btn.onclick = () => renderServiceList(wrap, cat, sub.items, sub);
    grid.appendChild(btn);
  });
  panel.appendChild(grid);
  showPanel(wrap, panel);
}

function renderServiceList(wrap, cat, items, context) {
  wrap.innerHTML = '';
  const panel = document.createElement('div');
  // Back button
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'svc-back';
  back.innerHTML = `← <span data-de="Zurück" data-ru="Назад" data-en="Back">${{de:'Zurück',ru:'Назад',en:'Back'}[currentLang]}</span>`;
  back.onclick = () => {
    if (cat.subs) renderSubcategories(wrap, cat);
    else renderCategoryGrid(wrap);
  };
  panel.appendChild(back);
  // Breadcrumb
  const bc = document.createElement('div');
  bc.className = 'svc-breadcrumb';
  bc.textContent = cat[currentLang] + (context !== cat ? ' → ' + context[currentLang] : '');
  panel.appendChild(bc);
  // Services list
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'svc-item';
    div.innerHTML = `<span>${item[currentLang]}</span><span class="svc-price">${item.p}</span>`;
    div.onclick = () => {
      panel.querySelectorAll('.svc-item').forEach(s => s.classList.remove('active'));
      div.classList.add('active');
      const fullName = cat[currentLang] + ' → ' + (context !== cat ? context[currentLang] + ' → ' : '') + item[currentLang];
      selectedServiceId = cat.id + '__' + item[currentLang].toLowerCase().replace(/\s+/g,'-');
      selectedServiceName = fullName;
      selectedServicePrice = item.p;
      document.getElementById('selectedServiceId').value = selectedServiceId;
      document.getElementById('selectedServiceName').value = fullName + ' (' + item.p + ')';
      // Show badge
      let badge = wrap.querySelector('.svc-chosen-badge');
      if (badge) badge.remove();
      badge = document.createElement('div');
      badge.className = 'svc-chosen-badge';
      badge.innerHTML = `<span>${item[currentLang]}</span><span>${item.p} <span class="svc-change" data-de="ändern" data-ru="изменить" data-en="change">${{de:'ändern',ru:'изменить',en:'change'}[currentLang]}</span></span>`;
      badge.querySelector('.svc-change').onclick = (e) => { e.stopPropagation(); renderCategoryGrid(wrap); };
      wrap.appendChild(badge);
      unlockStep('blockDate');
    };
    panel.appendChild(div);
  });
  showPanel(wrap, panel);
}

function showPanel(wrap, el) {
  el.classList.add('svc-panel');
  wrap.appendChild(el);
  requestAnimationFrame(() => { el.classList.add('active'); });
}

function unlockStep(blockId) {
  const el = document.getElementById(blockId);
  if (el) {
    el.classList.remove('locked');
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
}

/* ============ BOOKING: CALENDAR ============ */
// 1 HOUR SLOTS
const allSlots = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
let selectedTime = null;

let calYear, calMonth;
const WD = {de:['Mo','Di','Mi','Do','Fr','Sa','So'],ru:['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],en:['Mo','Tu','We','Th','Fr','Sa','Su']};
const MONTHS = {
  de:['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
  ru:['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  en:['January','February','March','April','May','June','July','August','September','October','November','December']
};

function initCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
  document.getElementById('calPrev').onclick = () => {
    const now2 = new Date(); // don't go before current month
    if (calMonth === now2.getMonth() && calYear === now2.getFullYear()) return;
    calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  };
  document.getElementById('calNext').onclick = () => {
    calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  };
}

function renderCalendar() {
  const lang = currentLang;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const selectedDateVal = document.getElementById('bookingDate').value;

  document.getElementById('calMonthLabel').textContent = MONTHS[lang][calMonth] + ' ' + calYear;

  // Weekday headers
  const wdEl = document.getElementById('calWeekdays');
  wdEl.innerHTML = WD[lang].map(d => `<div class="cal-wd">${d}</div>`).join('');

  // Days grid (Mo-start)
  const daysEl = document.getElementById('calDays');
  daysEl.innerHTML = '';

  let firstDow = new Date(calYear, calMonth, 1).getDay();
  firstDow = (firstDow + 6) % 7; // Mo=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div'); e.className = 'cal-day empty'; daysEl.appendChild(e);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    btn.textContent = d;
    if (dateStr === todayStr) btn.classList.add('today');
    if (dateStr < todayStr) btn.classList.add('disabled');
    if (dateStr === selectedDateVal) btn.classList.add('active');
    btn.onclick = () => onDaySelect(dateStr, btn);
    daysEl.appendChild(btn);
  }
}

function onDaySelect(dateStr, btn) {
  document.getElementById('bookingDate').value = dateStr;
  document.querySelectorAll('.cal-day').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  unlockStep('blockTime');
  loadTimeSlots(dateStr);
}

/* ============ BOOKING: TIME GRID ============ */
async function loadTimeSlots(dateValue) {
  selectedTime = null;
  document.getElementById('selectedTime').value = '';
  const empty  = document.getElementById('timeSlotsEmpty');
  const wrap   = document.getElementById('timeGridWrap');
  empty.classList.add('hidden');

  // Show skeleton
  wrap.innerHTML = allSlots.slice(0,8).map(() =>
    `<div class="skeleton" style="height:38px"></div>`
  ).join('');
  wrap.classList.remove('fade-up');

  let formattedDate = dateValue;
  if (dateValue.includes('.')) {
    const [d,m,y] = dateValue.split('.');
    formattedDate = `${y}-${m}-${d}`;
  }

  try {
    ensureSDKs();
    
    // Fetch bookings & blocked slots concurrently
    const [bookingsRes, blocksRes] = await Promise.all([
      supabaseClient.from('bookings').select('time').eq('date', formattedDate).neq('status', 'cancelled'),
      supabaseClient.from('blocked_slots').select('time, is_full_day').eq('date', formattedDate)
    ]);

    const bookedSlots = bookingsRes.error ? [] : (bookingsRes.data || []).map(b => String(b.time||'').trim().substring(0, 5));
    const blockedSlots = blocksRes.error ? [] : (blocksRes.data || []);
    
    const isFullDayBlocked = blockedSlots.some(b => b.is_full_day === true);
    
    const now = new Date();
    const isToday = now.toDateString() === new Date(formattedDate).toDateString();

    let freeSlots = [];
    if (!isFullDayBlocked) {
      freeSlots = allSlots.filter(t => {
        if (bookedSlots.includes(t)) return false;
        if (blockedSlots.some(b => String(b.time||'').substring(0,5) === t)) return false;
        if (isToday) {
        const [h,m] = t.split(':');
        const slotTime = new Date();
        slotTime.setHours(parseInt(h), parseInt(m), 0, 0);
        if (slotTime <= now) return false;
      }
      return true;
    });
  }

    wrap.innerHTML = '';
    wrap.classList.add('fade-up');

    if (freeSlots.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    freeSlots.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'time-btn';
      btn.textContent = t;
      btn.onclick = () => {
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTime = t;
        document.getElementById('selectedTime').value = t;
      };
      wrap.appendChild(btn);
    });
  } catch(e) {
    console.error('loadTimeSlots error', e);
    wrap.innerHTML = '';
  }
}


function resetBooking() {
  document.getElementById('bookingSuccess').classList.add('hidden');
  document.getElementById('bookingStep1').classList.remove('hidden');
  // Clear form fields
  document.getElementById('bookingForm').reset();
  document.getElementById('selectedServiceId').value = '';
  document.getElementById('selectedServiceName').value = '';
  document.getElementById('bookingDate').value = '';
  document.getElementById('selectedTime').value = '';
  selectedServiceId = null;
  selectedServiceName = null;
  selectedServicePrice = null;
  selectedTime = null;
  // Reset service picker
  const wrap = document.getElementById('svcPickerWrap');
  if (wrap) renderCategoryGrid(wrap);
  // Re-lock steps
  document.getElementById('blockDate').classList.add('locked');
  document.getElementById('blockTime').classList.add('locked');
  // Scroll to booking section
  setTimeout(() => {
    const y = document.getElementById('booking').getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({top: y, behavior: 'smooth'});
  }, 100);
}

async function bookingSubmit(e) {
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.textContent = '...';
  btn.disabled = true;

  // ── Сбор данных формы ──
  const svcId = document.getElementById('selectedServiceId').value;
  const svcText = document.getElementById('selectedServiceName').value || '';
  const date = document.getElementById('bookingDate').value;
  const time = document.getElementById('selectedTime').value;
  const name = document.getElementById('bookingName').value;
  const phone = document.getElementById('bookingPhone').value;
  const email = document.getElementById('bookingEmail').value;
  const notes = document.getElementById('bookingNotes')?.value || '';

  // ── Валидация ──
  const msgs = sysMessages[currentLang] || sysMessages['de'];
  if (!svcId) {
    showNotification(currentLang === 'ru' ? 'Выберите услугу' : currentLang === 'en' ? 'Please select a service' : 'Bitte Behandlung wählen');
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }
  if (!date) {
    showNotification(msgs.pickDate);
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }
  if (!time) {
    showNotification(msgs.pickTime);
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }
  if (!name || !phone || !email) {
    showNotification(msgs.fillAll);
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }
  if (!email.includes('@')) {
    showNotification(msgs.invalidEmail);
    btn.disabled = false;
    btn.textContent = originalText;
    return;
  }

  // Объект с данными формы для логов и отправки
  const formData = { service: svcText, date, time, name, phone, email, notes };
  console.log('BOOKING DATA:', formData);

  // ── 1. СОХРАНЕНИЕ В SUPABASE ──
  try {
    const { error } = await supabaseClient.from('bookings').insert([{
      service: svcText,
      date: date,
      time: time,
      name: name,
      phone: phone,
      email: email,
      notes: notes,
      status: 'pending'
    }]);

    if (error) {
      console.error('DB ERROR', error);
      
      // Проверка на ошибку уникального constraint (если кто-то успел занять слот)
      if (error.message && (error.message.includes('duplicate') || error.code === '23505')) {
        showNotification(msgs.slotTaken);
      } else {
        showNotification(msgs.error);
      }
      
      btn.disabled = false;
      btn.textContent = originalText;
      
      // Обновляем слоты, так как кто-то другой уже занял это время
      if (error.message && (error.message.includes('duplicate') || error.code === '23505')) {
        selectedTime = null;
        await loadTimeSlots(date);
      }
      return;            // ← останавливаемся, email НЕ отправляем и success НЕ показываем
    }

    console.log('DB SUCCESS');
    
    // Обновляем слоты в UI и сбрасываем выбор
    selectedTime = null;
    await loadTimeSlots(date);

  } catch (dbErr) {
    console.error('DB ERROR', dbErr);
    showNotification(msgs.error);
    btn.disabled = false;
    btn.textContent = originalText;
    return;              // ← останавливаемся, email НЕ отправляем
  }

  // ── 2. ПОКАЗЫВАЕМ SUCCESS-БЛОК (сразу после успешной записи в БД) ──
  const labels = {
    de: { svc: 'Behandlung', date: 'Datum', time: 'Uhrzeit', name: 'Name', phone: 'Telefon', email: 'E-Mail' },
    ru: { svc: 'Услуга', date: 'Дата', time: 'Время', name: 'Имя', phone: 'Телефон', email: 'E-Mail' },
    en: { svc: 'Treatment', date: 'Date', time: 'Time', name: 'Name', phone: 'Phone', email: 'Email' }
  };
  const l = labels[currentLang] || labels['de'];

  document.getElementById('bookingSummary').innerHTML = `
    <div class="flex justify-between items-start border-b border-espresso/10 pb-3 gap-6"><span class="font-bold whitespace-nowrap">${l.svc}</span><span class="text-right text-espresso/80 leading-snug">${svcText}</span></div>
    <div class="flex justify-between items-center border-b border-espresso/10 py-3 gap-6"><span class="font-bold">${l.date}</span><span class="text-right text-espresso/80">${date}</span></div>
    <div class="flex justify-between items-center border-b border-espresso/10 py-3 gap-6"><span class="font-bold">${l.time}</span><span class="text-right text-espresso/80">${time}</span></div>
    <div class="flex justify-between items-center border-b border-espresso/10 py-3 gap-6"><span class="font-bold">${l.name}</span><span class="text-right text-espresso/80">${name}</span></div>
    <div class="flex justify-between items-center border-b border-espresso/10 py-3 gap-6"><span class="font-bold">${l.phone}</span><span class="text-right text-espresso/80">${phone}</span></div>
    <div class="flex justify-between items-center pt-3 gap-6"><span class="font-bold">${l.email}</span><span class="text-right text-espresso/80 truncate" title="${email}">${email}</span></div>
  `;

  document.getElementById('bookingStep1').classList.add('hidden');
  document.getElementById('bookingSuccess').classList.remove('hidden');
  setTimeout(() => {
    const y = document.getElementById('booking').getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({top: y, behavior: 'smooth'});
  }, 100);

  // ── 3. ОТПРАВКА EMAIL (отдельный try/catch — не блокирует бронирование) ──
  try {
    ensureSDKs(); // гарантируем что emailjs.init() вызван
    console.log('EMAIL START', formData);

    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE_CLIENT, {
      client_name: name,
      client_email: email,
      service: svcText,
      date: date,
      time: time,
      phone: phone
    });

    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE_ADMIN, {
      client_name: name,
      client_email: email,
      service: svcText,
      date: date,
      time: time,
      phone: phone,
      admin_email: ADMIN_EMAIL
    });

    console.log('EMAIL SUCCESS');
  } catch (emailError) {
    console.error('EMAIL ERROR', emailError);
  }

  btn.disabled = false;
  btn.textContent = originalText;
}

/* ============ LANGUAGE ============ */
function selectLang(lang){
  currentLang=lang;
  document.getElementById('langLabel').textContent=lang.toUpperCase();
  document.querySelectorAll('.lang-option').forEach(o=>{o.classList.toggle('active',o.dataset.lang===lang)});
  document.querySelectorAll('.lang-mobile-option').forEach(o=>{
    const isActive = o.classList.contains(lang);
    o.classList.toggle('text-rose', isActive);
    o.classList.toggle('text-espresso', isActive);
    o.classList.toggle('text-espresso/50', !isActive);
  });
  document.getElementById('langSwitcher').classList.remove('open');
  document.querySelectorAll('[data-de]').forEach(el=>{
    if(el.tagName==='INPUT'||el.tagName==='TEXTAREA')return;
    const v=el.getAttribute('data-'+currentLang);if(v)el.innerHTML=v;
  });
  document.querySelectorAll('[data-de-placeholder]').forEach(el=>{
    const v=el.getAttribute('data-'+currentLang+'-placeholder');if(v)el.placeholder=v;
  });
}
document.addEventListener('click',e=>{const s=document.getElementById('langSwitcher');if(!s.contains(e.target))s.classList.remove('open')});
function closeMobile(){document.getElementById('mobileOverlay').classList.remove('open')}

/* ============ OBSERVER ============ */
function initObserver(){
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');obs.unobserve(entry.target)}});
  },{threshold:0.1,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.hand-left,.hand-right').forEach(el=>obs.observe(el));
}

// Load procedures from DB (replaces static arrays), then build all
(async function initPage() {
  await loadProceduresFromDB();
  buildGallery(); buildReviews(); buildFaq(); initCalendar(); initObserver();
  selectLang(currentLang);
})();
/* ============ SMOOTH SCROLL (LENIS) ============ */
const lenis = new Lenis({
  duration: 1.0,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 1.5
});
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Override native anchor links to use lenis
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = this.getAttribute('href');
    if(target && target !== '#') {
      lenis.scrollTo(target, { offset: -80 });
    }
  });
});

// Cinematic Parallax (Max Performance & Zero Stutter)
function initParallax() {
  const img = document.getElementById('heroImg');
  const aboutWrap = document.getElementById('aboutPhotoWrap');

  // Only apply safe GPU hints. 
  // We remove 'preserve-3d' and 'backface-visibility' as they severely lag SVG and other CSS animations!
  if (img) {
    img.style.willChange = 'transform';
    img.style.transformOrigin = 'center';
  }
  
  if (aboutWrap) {
    // Ensuring no CSS transitions fight with Javascript during scroll
    aboutWrap.style.transition = 'none';
  }

  // Pre-calculate positions to prevent "Layout Thrashing" (dropping FPS)
  let aboutParentTop = 0;
  let aboutParentHeight = 0;
  let winH = window.innerHeight;

  function cacheDimensions() {
    winH = window.innerHeight;
    if (aboutWrap && aboutWrap.parentElement) {
      const rect = aboutWrap.parentElement.getBoundingClientRect();
      aboutParentTop = rect.top + window.scrollY;
      aboutParentHeight = rect.height;
    }
  }

  // Delay cache so DOM paints fully, then listen to window resizes
  setTimeout(cacheDimensions, 100);
  window.addEventListener('resize', cacheDimensions);

  let lastScroll = -9999;

  function render() {
    // Hook into Lenis perfectly
    const currentScroll = lenis.scroll !== undefined ? lenis.scroll : window.scrollY;

    // Prevent redundant style recalculations (saves lots of CPU)
    if (Math.abs(currentScroll - lastScroll) < 0.1) return;
    lastScroll = currentScroll;

    // Image parallax (Hero)
    if (img) {
      if (window.innerWidth >= 768) {
        // Desktop: Keep JS Parallax exactly as is
        const y = currentScroll * 0.45;
        const scale = 1 + currentScroll * 0.0005;
        img.style.transform = `translateY(${y.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      } else {
        // Mobile: Static
        img.style.transform = `none`;
      }
    }

    // About section parallax
    if (aboutWrap) {
      if (window.innerWidth >= 768) {
        const rectTop = aboutParentTop - currentScroll;
        const progress = Math.max(0, Math.min(1, (winH - rectTop) / (winH + aboutParentHeight)));
        
        const fadeStart = 0.55;
        const fadeProgress = Math.max(0, (progress - fadeStart) / (1 - fadeStart));
        const translateY = fadeProgress * 140;
        const scale = 1 - fadeProgress * 0.04;
        
        aboutWrap.style.transform = `translateY(${translateY.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      } else {
        // Mobile: Static
        aboutWrap.style.transform = `none`;
      }
    }
  }

  // Bind to Lenis event purely
  lenis.on('scroll', render);
  render();
}
initParallax();

// Override native anchor links to use lenis
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = this.getAttribute('href');
    if(target && target !== '#') {
      lenis.scrollTo(target, { offset: -80 });
    }
  });
});

/* ============ COOKIE CONSENT & DYNAMIC SCRIPTS ============ */
function loadEmailJS() {
  if (typeof emailjs !== 'undefined') return;
  const script = document.createElement('script');
  script.src = "https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js";
  document.body.appendChild(script);

  script.onload = () => {
    emailjs.init("m8z17diP3z4clm47h");
  };
}

function acceptCookies(type) {
  localStorage.setItem('cookieConsent', type);
  document.getElementById('cookieBanner').classList.remove('translate-y-0');
  if (type === 'accepted') {
    loadEmailJS();
  }
}

function initCookies() {
  const consent = localStorage.getItem('cookieConsent');
  if (!consent) {
    setTimeout(() => {
      document.getElementById('cookieBanner').classList.add('translate-y-0');
    }, 1000);
  } else if (consent === 'accepted') {
    loadEmailJS();
  }
}

// Call on load
initCookies();

// Header scroll effect
window.addEventListener('scroll', function() {
  const header = document.getElementById('mainHeader');
  if (window.scrollY > 20) {
    header.classList.remove('bg-transparent', 'border-transparent');
    header.classList.add('bg-cream/80', 'backdrop-blur-md', 'border-cream-dark/40');
  } else {
    header.classList.add('bg-transparent', 'border-transparent');
    header.classList.remove('bg-cream/80', 'backdrop-blur-md', 'border-cream-dark/40');
  }
});

// CLINIC SLIDER LOGIC
const clinicImages = [
  "assets/images/clinic/clinic-1.jpg",
  "assets/images/clinic/clinic-2.jpg",
  "assets/images/clinic/clinic-3.jpg",
  "assets/images/clinic/clinic-4.jpg"
];

let clinicSliderInterval;

function changeClinicSlide(index, event) {
  if (event) {
    event.stopPropagation(); // Prevent opening lightbox when clicking dots
    clearInterval(clinicSliderInterval); // Stop autoplay if user manually clicks
    startClinicAutoplay(); // Restart autoplay timer
  }
  
  // Update opacity of slides
  for (let i = 0; i < 4; i++) {
    const slide = document.getElementById('clinicSlide' + i);
    
    if (i === index) {
      slide.classList.remove('opacity-0');
      slide.classList.add('opacity-100');
    } else {
      slide.classList.remove('opacity-100');
      slide.classList.add('opacity-0');
    }
  }
  
  // Update Lightbox src on the container
  document.getElementById('clinicSlider').dataset.src = clinicImages[index];
}

function startClinicAutoplay() {
  clinicSliderInterval = setInterval(() => {
    let currentIndex = 0;
    for (let i = 0; i < 4; i++) {
      if (document.getElementById('clinicSlide' + i).classList.contains('opacity-100')) {
        currentIndex = i;
        break;
      }
    }
    let nextIndex = (currentIndex + 1) % 4;
    changeClinicSlide(nextIndex);
  }, 4000);
}

// Start autoplay initially
startClinicAutoplay();

