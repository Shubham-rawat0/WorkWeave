function isProductionRuntime(): boolean {
    return process.env.NODE_ENV === "production";
}

