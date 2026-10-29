-- public tutor profiles: the subject list, each tutor's profile, and which subjects they teach.
-- paste the whole file into the supabase SQL editor and run it once. safe to run again.

create table if not exists public.subjects (
  id    bigint generated always as identity primary key,
  level text not null check (level in ('IGCSE', 'AS', 'A Level', 'Other')),
  name  text not null,
  unique (level, name)
);

-- what visitors see on the tutors page. kept apart from profiles so the public
-- endpoint can never leak private columns like email or role
create table if not exists public.tutor_profiles (
  tutor_id        uuid primary key references public.profiles(id) on delete cascade,
  display_name    text not null check (char_length(display_name) between 1 and 40),
  grade           int  check (grade between 7 and 13),
  bio             text check (char_length(bio) <= 400),
  listed          boolean not null default true,    -- the tutor can hide themselves
  hidden_by_admin boolean not null default false,   -- admins can hide anyone
  updated_at      timestamptz not null default now()
);

create table if not exists public.tutor_subjects (
  tutor_id   uuid   not null references public.tutor_profiles(tutor_id) on delete cascade,
  subject_id bigint not null references public.subjects(id) on delete cascade,
  primary key (tutor_id, subject_id)
);

create index if not exists tutor_subjects_subject on public.tutor_subjects (subject_id);

-- only the backend (secret key) can read or write these
alter table public.subjects       enable row level security;
alter table public.tutor_profiles enable row level security;
alter table public.tutor_subjects enable row level security;

grant select, insert, update, delete
  on public.subjects, public.tutor_profiles, public.tutor_subjects to service_role;

-- starting subject list, taken from the old hard-coded tutors list.
-- add more later in Table Editor -> subjects (level must be IGCSE, AS, A Level or Other)
insert into public.subjects (level, name) values
  ('IGCSE', 'Mathematics'),
  ('IGCSE', 'Additional Mathematics'),
  ('IGCSE', 'Computer Science'),
  ('IGCSE', 'ICT'),
  ('IGCSE', 'Coordinated Science'),
  ('IGCSE', 'Combined Science'),
  ('IGCSE', 'Economics'),
  ('IGCSE', 'Business'),
  ('IGCSE', 'Accounting'),
  ('IGCSE', 'Sociology'),
  ('IGCSE', 'First Language English'),

  ('AS', 'Mathematics (Pure 1)'),
  ('AS', 'Mathematics (Pure 2)'),
  ('AS', 'Physics'),
  ('AS', 'Chemistry'),
  ('AS', 'Biology'),
  ('AS', 'Computer Science'),
  ('AS', 'Information Technology'),
  ('AS', 'Economics'),
  ('AS', 'Media Studies'),

  ('A Level', 'Mathematics (Pure 3)'),
  ('A Level', 'Physics'),
  ('A Level', 'Chemistry'),
  ('A Level', 'Biology'),
  ('A Level', 'Economics'),
  ('A Level', 'Media Studies'),

  ('Other', 'English (Grade 7–8)')
on conflict (level, name) do nothing;
