
-- Helper: user has any staff role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','cashier')
  )
$$;

-- PRODUCTS
DROP POLICY "Authenticated manage products" ON public.products;
CREATE POLICY "Staff read products" ON public.products
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff write products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update products" ON public.products
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete products" ON public.products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- CLIENTS
DROP POLICY "Authenticated manage clients" ON public.clients;
CREATE POLICY "Staff read clients" ON public.clients
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update clients" ON public.clients
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete clients" ON public.clients
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- CLIENT PACKS
DROP POLICY "Authenticated manage client_packs" ON public.client_packs;
CREATE POLICY "Staff read packs" ON public.client_packs
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert packs" ON public.client_packs
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update packs" ON public.client_packs
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete packs" ON public.client_packs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- SALES
DROP POLICY "Authenticated manage sales" ON public.sales;
CREATE POLICY "Staff read sales" ON public.sales
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND cashier_id = auth.uid());
CREATE POLICY "Admin update sales" ON public.sales
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete sales" ON public.sales
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- SALE ITEMS
DROP POLICY "Authenticated manage sale_items" ON public.sale_items;
CREATE POLICY "Staff read sale_items" ON public.sale_items
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert sale_items" ON public.sale_items
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin modify sale_items" ON public.sale_items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete sale_items" ON public.sale_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- APPOINTMENTS
DROP POLICY "Authenticated manage appointments" ON public.appointments;
CREATE POLICY "Staff read appointments" ON public.appointments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff insert appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
