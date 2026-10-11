-- ================================================
-- Beauty Glanz — Tabelle "procedures"
-- Ausführen in: Supabase → SQL Editor → Run
-- ================================================

CREATE TABLE IF NOT EXISTS public.procedures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      text NOT NULL,
  category_sort    smallint NOT NULL DEFAULT 0,
  category_de      text NOT NULL,
  category_ru      text NOT NULL,
  category_en      text NOT NULL,
  subcategory_id   text,
  subcategory_sort smallint NOT NULL DEFAULT 0,
  subcategory_de   text,
  subcategory_ru   text,
  subcategory_en   text,
  name_de          text NOT NULL,
  name_ru          text NOT NULL,
  name_en          text NOT NULL,
  price            text NOT NULL,
  show_in_booking  boolean NOT NULL DEFAULT true,
  sort_order       smallint NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select" ON public.procedures;
DROP POLICY IF EXISTS "anon_all"    ON public.procedures;
CREATE POLICY "anon_select" ON public.procedures FOR SELECT TO anon USING (true);
CREATE POLICY "anon_all"    ON public.procedures FOR ALL    TO anon USING (true) WITH CHECK (true);

-- ================================================
-- ДАННЫЕ (все категории)
-- ================================================

INSERT INTO public.procedures
  (category_id, category_sort, category_de, category_ru, category_en,
   subcategory_id, subcategory_sort, subcategory_de, subcategory_ru, subcategory_en,
   name_de, name_ru, name_en, price, show_in_booking, sort_order)
VALUES

-- ── NAILS (1) ────────────────────────────────────────────────
-- Sub: Neumodellage
('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'neumodellage',1,'Neumodellage','Наращивание','New set',
 'Neumodellage Natur','Наращивание (натуральный)','New set (natural)','50 €',true,1),

('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'neumodellage',1,'Neumodellage','Наращивание','New set',
 'Neumodellage Farben','Наращивание (цвет)','New set (color)','59 €',true,2),

('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'neumodellage',1,'Neumodellage','Наращивание','New set',
 'Neumodellage French/Babyboomer','Наращивание French/Babyboomer','New set French/Babyboomer','69 €',true,3),

-- Sub: Auffüllen
('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'auffüllen',2,'Auffüllen','Коррекция','Refill',
 'Auffüllen Natur','Коррекция (натуральный)','Refill (natural)','44 €',true,1),

('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'auffüllen',2,'Auffüllen','Коррекция','Refill',
 'Auffüllen Farben','Коррекция (цвет)','Refill (color)','49 €',true,2),

('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'auffüllen',2,'Auffüllen','Коррекция','Refill',
 'Auffüllen French/Babyboomer','Коррекция French/Babyboomer','Refill French/Babyboomer','55 €',true,3),

-- Sub: Maniküre
('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'manikure',3,'Maniküre','Маникюр','Manicure',
 'Maniküre-Classic ohne Lack','Классический маникюр (без лака)','Classic manicure (no polish)','30 €',true,1),

('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'manikure',3,'Maniküre','Маникюр','Manicure',
 'Maniküre mit Lack','Маникюр с лаком','Manicure with polish','40 €',true,2),

-- Sub: Extras (nicht buchbar)
('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'extras',4,'Extras','Дополнения','Extras',
 'Nail-Art, pro Nagel','Дизайн ногтей, 1 ноготь','Nail art, per nail','2 €',false,1),

('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'extras',4,'Extras','Дополнения','Extras',
 'Swarovski Steine 1 Stk.','Камни Swarovski 1 шт.','Swarovski stones 1 pc.','0,50 €',false,2),

('nails',1,'Nägel & Maniküre','Ногти и Маникюр','Nails & Manicure',
 'extras',4,'Extras','Дополнения','Extras',
 'Reparatur Nagel','Ремонт ногтя','Nail repair','5 €',false,3),

-- ── PEDICURE (2) ─────────────────────────────────────────────
-- Sub: Classic
('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'classic',1,'Pediküre Classic','Педикюр Classic','Classic Pedicure',
 'Pediküre-Classic ohne Lack','Классический педикюр (без лака)','Classic pedicure (no polish)','40 €',true,1),

('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'classic',1,'Pediküre Classic','Педикюр Classic','Classic Pedicure',
 'Pediküre mit Lack','Педикюр с лаком','Pedicure with polish','46 €',true,2),

('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'classic',1,'Pediküre Classic','Педикюр Classic','Classic Pedicure',
 'Pediküre Gel-Lack / Shellac','Педикюр гель-лак / Shellac','Pedicure gel polish / Shellac','56 €',true,3),

-- Sub: Smart
('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'smart',2,'Smart-Pediküre','Смарт-педикюр','Smart Pedicure',
 'Smart-Pediküre ohne Lack','Смарт-педикюр (без лака)','Smart pedicure (no polish)','50 €',true,1),

('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'smart',2,'Smart-Pediküre','Смарт-педикюр','Smart Pedicure',
 'Smart-Pediküre mit Lack','Смарт-педикюр с лаком','Smart pedicure with polish','59 €',true,2),

('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'smart',2,'Smart-Pediküre','Смарт-педикюр','Smart Pedicure',
 'Smart-Pediküre mit Gel-Lack','Смарт-педикюр с гель-лаком','Smart pedicure with gel polish','69 €',true,3),

-- Sub: SPA
('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'spa',3,'SPA Fußpflege','SPA педикюр','SPA Pedicure',
 'SPA Fußpflege (Peeling, Maske, Aroma Kerze)','SPA педикюр (пилинг, маска, аромасвеча)','SPA pedicure (peeling, mask, candle)','50 €',true,1),

('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'spa',3,'SPA Fußpflege','SPA педикюр','SPA Pedicure',
 'SPA Füße mit Lack','SPA педикюр с лаком','SPA pedicure with polish','59 €',true,2),

('pedicure',2,'Pediküre & SPA','Педикюр и SPA','Pedicure & SPA',
 'spa',3,'SPA Fußpflege','SPA педикюр','SPA Pedicure',
 'SPA Füße mit Gel-Lack','SPA педикюр с гель-лаком','SPA pedicure with gel polish','69 €',true,3),

-- ── BROWS (3) — flach, keine Subkategorie ────────────────────
('brows',3,'Augenbrauen & Lifting','Брови и Лифтинг','Brows & Lifting',
 null,0,null,null,null,
 'Wimpernlifting mit färben','Лифтинг ресниц + окрашивание','Lash lifting + tinting','70 €',true,1),

('brows',3,'Augenbrauen & Lifting','Брови и Лифтинг','Brows & Lifting',
 null,0,null,null,null,
 'Augenbrauenlifting mit färben','Лифтинг бровей + окрашивание','Brow lifting + tinting','75 €',true,2),

('brows',3,'Augenbrauen & Lifting','Брови и Лифтинг','Brows & Lifting',
 null,0,null,null,null,
 'Augenbrauen färben mit Henna','Окрашивание бровей хной','Brow tinting with henna','40 €',true,3),

('brows',3,'Augenbrauen & Lifting','Брови и Лифтинг','Brows & Lifting',
 null,0,null,null,null,
 'Wimpern färben','Окрашивание ресниц','Lash tinting','15 €',true,4),

('brows',3,'Augenbrauen & Lifting','Брови и Лифтинг','Brows & Lifting',
 null,0,null,null,null,
 'Augenbrauen färben','Окрашивание бровей','Brow tinting','15 €',true,5),

('brows',3,'Augenbrauen & Lifting','Брови и Лифтинг','Brows & Lifting',
 null,0,null,null,null,
 'Augenbrauen zupfen','Коррекция бровей','Brow shaping','15 €',true,6),

-- ── LASHES (4) ───────────────────────────────────────────────
-- Sub: Classic 1:1
('lashes',4,'Wimpernverlängerung','Наращивание ресниц','Lash Extensions',
 'classic',1,'Classic 1:1','Классика 1:1','Classic 1:1',
 'Naturlashes Look, Classic 1:1 Neu','Классика 1:1 (Новое)','Classic 1:1 (New set)','79 €',true,1),

('lashes',4,'Wimpernverlängerung','Наращивание ресниц','Lash Extensions',
 'classic',1,'Classic 1:1','Классика 1:1','Classic 1:1',
 'Auffüllung bis 2 Wochen','Коррекция (до 2 нед.)','Refill (up to 2 weeks)','39 €',true,2),

('lashes',4,'Wimpernverlängerung','Наращивание ресниц','Lash Extensions',
 'classic',1,'Classic 1:1','Классика 1:1','Classic 1:1',
 'Auffüllung bis 3 Wochen','Коррекция (до 3 нед.)','Refill (up to 3 weeks)','49 €',true,3),

('lashes',4,'Wimpernverlängerung','Наращивание ресниц','Lash Extensions',
 'classic',1,'Classic 1:1','Классика 1:1','Classic 1:1',
 'Auffüllung bis 4 Wochen','Коррекция (до 4 нед.)','Refill (up to 4 weeks)','59 €',true,4),

-- Sub: Mascara Look 2-3D
('lashes',4,'Wimpernverlängerung','Наращивание ресниц','Lash Extensions',
 'volume',2,'Mascara Look 2-3D','Объём 2-3D','Volume 2-3D',
 'Mascara Look 2-3D Neu','Mascara Look 2-3D (Новое)','Mascara Look 2-3D (New set)','89 €',true,1),

('lashes',4,'Wimpernverlängerung','Наращивание ресниц','Lash Extensions',
 'volume',2,'Mascara Look 2-3D','Объём 2-3D','Volume 2-3D',
 'Auffüllung 2-3D bis 2 Wochen','Коррекция 2-3D (до 2 нед.)','Refill 2-3D (up to 2 weeks)','40 €',true,2),

('lashes',4,'Wimpernverlängerung','Наращивание ресниц','Lash Extensions',
 'volume',2,'Mascara Look 2-3D','Объём 2-3D','Volume 2-3D',
 'Auffüllung 2-3D bis 3 Wochen','Коррекция 2-3D (до 3 нед.)','Refill 2-3D (up to 3 weeks)','59 €',true,3),

('lashes',4,'Wimpernverlängerung','Наращивание ресниц','Lash Extensions',
 'volume',2,'Mascara Look 2-3D','Объём 2-3D','Volume 2-3D',
 'Auffüllung 2-3D bis 4 Wochen','Коррекция 2-3D (до 4 нед.)','Refill 2-3D (up to 4 weeks)','69 €',true,4),

-- ── PERMANENT (5) ────────────────────────────────────────────
-- Sub: Augenbrauen
('permanent',5,'Permanent Make-up','Перманентный макияж','Permanent Make-up',
 'pm-brows',1,'Augenbrauen','Брови','Eyebrows',
 'Powder Brows','Пудровые брови (Powder Brows)','Powder Brows','230 €',true,1),

('permanent',5,'Permanent Make-up','Перманентный макияж','Permanent Make-up',
 'pm-brows',1,'Augenbrauen','Брови','Eyebrows',
 'Nachstechen in 5 Wochen (Brows)','Брови - Коррекция (через 5 нед.)','Brows - Touch up (in 5 weeks)','75 €',true,2),

-- Sub: Lippen
('permanent',5,'Permanent Make-up','Перманентный макияж','Permanent Make-up',
 'pm-lips',2,'Lippen','Губы','Lips',
 'Lippen','Губы','Lips','280 €',true,1),

('permanent',5,'Permanent Make-up','Перманентный макияж','Permanent Make-up',
 'pm-lips',2,'Lippen','Губы','Lips',
 'Nachstechen in 5 Wochen (Lippen)','Губы - Коррекция (через 5 нед.)','Lips - Touch up (in 5 weeks)','90 €',true,2),

-- Sub: Lidstrich
('permanent',5,'Permanent Make-up','Перманентный макияж','Permanent Make-up',
 'pm-liner',3,'Lidstrich','Стрелки','Eyeliner',
 'Lidstrich','Стрелки','Eyeliner','180 €',true,1),

('permanent',5,'Permanent Make-up','Перманентный макияж','Permanent Make-up',
 'pm-liner',3,'Lidstrich','Стрелки','Eyeliner',
 'Nachstechen in 5 Wochen (Lidstrich)','Стрелки - Коррекция (через 5 нед.)','Eyeliner - Touch up (in 5 weeks)','70 €',true,2),

-- ── WAXING (6) — flach ───────────────────────────────────────
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Oberlippe, 10 Min.','Верхняя губа, 10 мин.','Upper lip, 10 min.','14 €',true,1),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Kinn, 10 Min.','Подбородок, 10 мин.','Chin, 10 min.','16 €',true,2),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Oberlippe & Kinn, 15 Min.','Верхняя губа и подбородок, 15 мин.','Upper lip & chin, 15 min.','22 €',true,3),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Wange, 10 Min.','Щеки, 10 мин.','Cheeks, 10 min.','22 €',true,4),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Hals, 10 Min.','Шея, 10 мин.','Neck, 10 min.','28 €',true,5),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Nase, 5 Min.','Нос, 5 мин.','Nose, 5 min.','12 €',true,6),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Ohren, 5 Min.','Уши, 5 мин.','Ears, 5 min.','12 €',true,7),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Gesicht komplett, 25 Min.','Лицо полностью, 25 мин.','Full face, 25 min.','44 €',true,8),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Nacken, 10 Min.','Затылок, 10 мин.','Nape, 10 min.','28 €',true,9),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Achseln, 10 Min.','Подмышки, 10 мин.','Underarms, 10 min.','28 €',true,10),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Unterarme, 20 Min.','Предплечья, 20 мин.','Forearms, 20 min.','32 €',true,11),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Oberarme, 25 Min.','Плечи, 25 мин.','Upper arms, 25 min.','38 €',true,12),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Arme komplett, 40 Min.','Руки полностью, 40 мин.','Full arms, 40 min.','65 €',true,13),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Arme komplett mit Achseln, 45 Min.','Руки и подмышки, 45 мин.','Full arms & underarms, 45 min.','75 €',true,14),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Unterschenkel inkl. Knie, 30 Min.','Голени вкл. колени, 30 мин.','Lower legs incl. knees, 30 min.','40 €',true,15),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Oberschenkel, 30 Min.','Бедра, 30 мин.','Upper legs, 30 min.','45 €',true,16),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Beine komplett, 45 Min.','Ноги полностью, 45 мин.','Full legs, 45 min.','70 €',true,17),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Rücken unten, 15 Min.','Спина (низ), 15 мин.','Lower back, 15 min.','28 €',true,18),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Rücken oben, 25 Min.','Спина (верх), 25 мин.','Upper back, 25 min.','35 €',true,19),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Rücken komplett, 35 Min.','Спина полностью, 35 мин.','Full back, 35 min.','58 €',true,20),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Schulter, 20 Min.','Плечи, 20 мин.','Shoulders, 20 min.','30 €',true,21),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Brust, 20 Min.','Грудь, 20 мин.','Chest, 20 min.','30 €',true,22),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Bauch, 25 Min.','Живот, 25 мин.','Stomach, 25 min.','35 €',true,23),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Bikinilinie, 15 Min.','Зона бикини, 15 мин.','Bikini line, 15 min.','30 €',true,24),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Intim inkl. Pofalte, 30-45 Min.','Бикини (вкл. межяг. складку), 30-45 мин.','Brazilian incl. gluteal cleft, 30-45 min.','ab 60 €',true,25),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Intim ohne Pofalte, 30 Min.','Бикини (без межяг. складки), 30 мин.','Brazilian excl. gluteal cleft, 30 min.','ab 55 €',true,26),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Nur Pofalte, 10 Min.','Только межягодичная складка, 10 мин.','Gluteal cleft only, 10 min.','ab 25 €',true,27),
('waxing',6,'Waxing & Haarentfernung','Депиляция (Воск)','Waxing',null,0,null,null,null,'Pobacken, 15 Min.','Ягодицы, 15 мин.','Buttocks, 15 min.','40 €',true,28);
