export type PackageType = 'BASIC' | 'PREMIUM' | 'VIP';
export type Package = { price: number; duration: number; name: string; };

export const PACKAGES: Record<PackageType, Package> = {
    BASIC: { price: 29, duration: 7, name: 'Básico (7 dias)' },
    PREMIUM: { price: 49, duration: 30, name: 'Premium (30 dias)' },
    VIP: { price: 1, duration: 90, name: 'VIP (90 dias)' }
}; 