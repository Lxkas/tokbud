export interface OrganizationDoc {
    id: string;
    code: string;
    name: string;
    location: {
        lat: number;
        lon: number;
    };
}