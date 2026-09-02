export enum EditType {
  Unspecified = 'Unspecified',
  RemovePeople = 'RemovePeople',
  RemoveObjects = 'RemoveObjects',
  RemovePhotographerShadow = 'RemovePhotographerShadow',
  Sharpen = 'Sharpen',
  BrightnessContrast = 'BrightnessContrast'
}

export const EDIT_TYPE_LABELS: Record<EditType, string> = {
  [EditType.Unspecified]: 'Unspecified',
  [EditType.RemovePeople]: 'Remove people',
  [EditType.RemoveObjects]: 'Remove non-people objects',
  [EditType.RemovePhotographerShadow]: "Remove photographer's shadow",
  [EditType.Sharpen]: 'Sharpen',
  [EditType.BrightnessContrast]: 'Fix brightness / contrast'
};

export const EDIT_TYPE_VALUES: EditType[] = Object.values(EditType);
