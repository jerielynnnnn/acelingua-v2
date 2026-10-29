ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp integer
    NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins integer
    NOT NULL DEFAULT 0;