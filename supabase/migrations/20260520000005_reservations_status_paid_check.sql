ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status IN ('pending', 'confirmed', 'paid', 'cancelled', 'temporary'));
