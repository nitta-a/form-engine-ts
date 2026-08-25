import { FormBuilderComponents, BuilderActionIconType } from '@form-engine-ts/react';
import { ReactNode } from 'react';

declare function muiDefaultIconResolver(actionType: BuilderActionIconType): ReactNode;
declare const muiBuilderComponents: FormBuilderComponents;
declare function createMuiBuilderComponents(customOverrides?: Partial<FormBuilderComponents>): FormBuilderComponents;

export { createMuiBuilderComponents, muiBuilderComponents, muiDefaultIconResolver };
