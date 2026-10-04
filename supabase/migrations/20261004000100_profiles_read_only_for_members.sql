-- Default privileges grant authenticated full table access; RLS already blocks profile writes,
-- but members only need to read profiles, so drop the write privileges as defense in depth.
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
