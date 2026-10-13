type ValidationResult =
    | { success: true; data: unknown; target: string }
    | { success: false; error: Error; data: unknown; target: string };

export const validationHook = (result: ValidationResult): void => {
    if (!result.success) {
        throw result.error;
    }
};
