
-- ============================================
-- ROLES
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users see their own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- PROFILES (auto-created on signup)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  -- First user becomes admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TYPE public.product_category AS ENUM (
  'periscolaire', 'laep', 'pmi', 'allaitement', 'perinatal',
  'naissance', 'soin', 'accouchement', 'atelier', 'cafe', 'food'
);

CREATE TYPE public.product_type AS ENUM ('unit', 'pack', 'session');

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category product_category NOT NULL,
  type product_type NOT NULL DEFAULT 'unit',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  pack_sessions INTEGER, -- if type=pack, number of sessions included
  duration_min INTEGER, -- duration in minutes for bookable services
  bookable BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage products" ON public.products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- CLIENTS
-- ============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  is_member BOOLEAN NOT NULL DEFAULT false,
  children_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage clients" ON public.clients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_clients_name ON public.clients(last_name, first_name);

-- ============================================
-- CLIENT PACKS (séances restantes)
-- ============================================
CREATE TABLE public.client_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  sessions_total INTEGER NOT NULL,
  sessions_remaining INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage client_packs" ON public.client_packs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- SALES
-- ============================================
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'transfer', 'pack');

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES auth.users(id),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_reason TEXT,
  total NUMERIC(10,2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'cash',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage sales" ON public.sales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_sales_created ON public.sales(created_at DESC);

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total NUMERIC(10,2) NOT NULL
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage sale_items" ON public.sale_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id),
  service_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 60,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage appointments" ON public.appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_appointments_starts ON public.appointments(starts_at);
