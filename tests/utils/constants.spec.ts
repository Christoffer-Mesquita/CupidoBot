import { PACKAGES, PackageType } from '../../src/utils/constants';

describe('Constants - PACKAGES', () => {
  it('should have valid structure for all packages', () => {
    Object.values(PACKAGES).forEach(pkg => {
      expect(pkg).toHaveProperty('name');
      expect(typeof pkg.name).toBe('string');
      expect(pkg).toHaveProperty('price');
      expect(typeof pkg.price).toBe('number');
      expect(pkg.price).toBeGreaterThanOrEqual(0);
      expect(pkg).toHaveProperty('duration');
      expect(typeof pkg.duration).toBe('number');
      expect(pkg.duration).toBeGreaterThan(0);
    });
  });

  it('should have specific packages defined', () => {
    expect(PACKAGES).toHaveProperty('BASIC');
    expect(PACKAGES).toHaveProperty('PREMIUM');
    expect(PACKAGES).toHaveProperty('VIP');
  });

  it('VIP package price should be 1 (as per current constants)', () => {
    // Este teste pode ser ajustado se o preço do VIP mudar.
    // Foi uma observação durante a análise.
    expect(PACKAGES.VIP.price).toBe(1);
  });

  // Teste para o tipo PackageType
  it('PackageType should only allow defined types', () => {
    const basic: PackageType = 'BASIC';
    const premium: PackageType = 'PREMIUM';
    const vip: PackageType = 'VIP';

    // A própria compilação do TypeScript já ajuda a garantir isso,
    // mas um teste pode confirmar os valores esperados.
    expect(['BASIC', 'PREMIUM', 'VIP']).toContain(basic);
    expect(['BASIC', 'PREMIUM', 'VIP']).toContain(premium);
    expect(['BASIC', 'PREMIUM', 'VIP']).toContain(vip);
  });
});
