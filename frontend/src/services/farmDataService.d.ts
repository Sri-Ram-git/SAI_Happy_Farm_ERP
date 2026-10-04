export interface FarmDoc {
    farmId: string;
    name: string;
    location: string;
    active: boolean;
    initialBirdCount?: number;
    currentBirdCount?: number;
    initialFeedKg?: number;
    currentFeedKg?: number;
    totalFeedLoadedKg?: number;
    totalFeedConsumedKg?: number;
    inventoryInitialized?: boolean;
    inventoryInitializedAt?: string;
    inventoryUpdatedAt?: string;
    updatedAt?: string;
    totalBirds?: number;
    currentBirds?: number;
}
export declare function getFarmById(farmId: string): Promise<FarmDoc | null>;
export declare function subscribeToFarm(farmId: string, callback: (farm: FarmDoc | null) => void): () => void;
export declare function getFarmsByIds(farmIds: string[]): Promise<FarmDoc[]>;
export declare function getAllFarms(): Promise<FarmDoc[]>;
export declare function subscribeToAllFarms(callback: (farms: FarmDoc[]) => void): () => void;
export declare function subscribeToFarms(farmIds: string[] | undefined, callback: (farms: FarmDoc[]) => void): () => void;
//# sourceMappingURL=farmDataService.d.ts.map