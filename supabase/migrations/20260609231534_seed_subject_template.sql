-- Scire seed_subject_template (§1.3 table 3, §9.2 step 10). The default admin
-- catalog: 19 Title-Case subjects x {Academic, ALP, IB} x grades 9-12 = 228 rows
-- (today's exact picker space). Idempotent: ON CONFLICT DO NOTHING against
-- UNIQUE NULLS NOT DISTINCT (name, category, grade_level). Edits here affect
-- FUTURE org creations only (the create_organization RPC snapshots these).
insert into public.subject_templates (name, category, grade_level)
select s.name, c.category, g.grade_level
from (values
  ('Math'), ('Functions'), ('Advanced Functions'), ('Calculus'), ('Data Management'),
  ('English'), ('Science'), ('Chemistry'), ('Physics'), ('Biology'),
  ('Civics'), ('Careers'), ('History'), ('Geography'), ('Business'),
  ('French'), ('Spanish'), ('Computer Science'), ('Accounting')
) as s(name)
cross join (values ('Academic'), ('ALP'), ('IB')) as c(category)
cross join (values (9::smallint), (10::smallint), (11::smallint), (12::smallint)) as g(grade_level)
on conflict on constraint subject_templates_triple_key do nothing;
