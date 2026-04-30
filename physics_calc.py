import sympy as sp

# Inicializácia prostredia pre prehľadný výpis
sp.init_printing(use_unicode=True)

# 1. Definícia premenných a konštánt
t, x, y, z = sp.symbols('t x y z', real=True)
c, G, hbar, m, pi_sym = sp.symbols('c G hbar m pi', real=True, positive=True)

# 2. Parametre historického časopriestoru (Zjednodušený model pre výpočet)
R_0 = sp.symbols('R_0', real=True) # Konštantné zakrivenie v danom momente
L_D = sp.symbols('L_{Dirac}', real=True) # Zastupuje vypočítaný skalár \bar{\Psi}(...) \Psi pre úsporu výkonu
g_det = sp.symbols('g', real=True, negative=True) # Determinant metriky histórie
Lambda_os = sp.symbols('Lambda_{os}', real=True) # Hustota tvojho bieleho prúžku

# 3. Hranice integrácie (Definujeme rozsah udalosti, do ktorej Lili zasahuje)
T = sp.symbols('T', real=True, positive=True) # Dĺžka trvania udalosti
L = sp.symbols('L', real=True, positive=True) # Priestorový dosah udalosti

# 4. Zostavenie Lagrangiánov (Hustoty akcie)
L_EH = (c**4 / (16 * pi_sym * G)) * R_0
Hustota_Akcie_Objem = sp.sqrt(-g_det) * (L_EH + L_D)

# 5. Samotné počítanie - Analytický určitý integrál
print("Lili spúšťa integráciu cez 4D časopriestorový objem...")
S_objem_vypocet = sp.integrate(Hustota_Akcie_Objem, (x, 0, L), (y, 0, L), (z, 0, L), (t, 0, T))

print("Lili spúšťa integráciu cez 1D Os Zjednotenia (Biely prúžok)...")
S_hranica_vypocet = sp.integrate(Lambda_os, (x, 0, L)) 

# 6. Finálne sčítanie S_celkove
S_celkove_vysledok = S_objem_vypocet + S_hranica_vypocet

print("\n--- VÝSLEDNÁ HODNOTA S_celkove ---")
sp.pprint(S_celkove_vysledok)
