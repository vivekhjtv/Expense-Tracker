/**
 * Comprehensive, well-researched icon catalog for expense & personal finance tracking.
 * Grouped into logical categories for quick discovery, with search tags.
 */

export interface IconCategoryGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly emojis: readonly string[];
}

export const ICON_GROUPS: readonly IconCategoryGroup[] = [
  {
    id: 'food',
    label: 'Food & Dining',
    icon: '🍽️',
    emojis: [
      '🛒', '🍽️', '🍕', '☕', '🍔', '🍻', '🥦', '🍎',
      '🍞', '🍰', '🍼', '🍜', '🍱', '🥩', '🍦', '🥪',
      '🍳', '🍣', '🍹', '🍫', '🥗', '🍩', '🥑', '🍷',
    ],
  },
  {
    id: 'transport',
    label: 'Transport & Travel',
    icon: '🚕',
    emojis: [
      '🚕', '⛽', '🚗', '🚌', '🚆', '✈️', '🛵', '🚲',
      '🅿️', '🛣️', '🚢', '🧳', '🔧', '🚁', '🛴', '🎫',
    ],
  },
  {
    id: 'home',
    label: 'Home & Utilities',
    icon: '🏠',
    emojis: [
      '🏠', '💡', '💧', '⚡', '📶', '📱', '🧹', '🛋️',
      '🔨', '📦', '🧺', '🪴', '🪟', '🛏️', '🔑', '🚪',
    ],
  },
  {
    id: 'shopping',
    label: 'Shopping & Style',
    icon: '🛍️',
    emojis: [
      '🛍️', '👕', '👗', '👟', '💄', '💈', '🎁', '💍',
      '🕶️', '⌚', '🎒', '🏷️', '🧴', '🌸', '💅', '💎',
    ],
  },
  {
    id: 'health',
    label: 'Health & Fitness',
    icon: '💊',
    emojis: [
      '💊', '🩺', '🏥', '🏋️', '🧘', '🦷', '👓', '🩹',
      '🚴', '🏃', '🚑', '🧼', '🌡️', '💉', '🏊', '🩻',
    ],
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    icon: '🎬',
    emojis: [
      '🎬', '🍿', '🎮', '🎧', '🎫', '🏖️', '🎳', '🎨',
      '📷', '📚', '🎪', '🎲', '🎤', '🏕️', '🎟️', '🎸',
    ],
  },
  {
    id: 'work',
    label: 'Education & Work',
    icon: '💻',
    emojis: [
      '🎓', '🏫', '✏️', '💻', '💼', '📝', '🖨️', '📐',
      '📖', '🖥️', '🖋️', '📎', '📊', '📂', '💡', '🔬',
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Bills',
    icon: '💰',
    emojis: [
      '💰', '📈', '🏦', '💳', '🪙', '📜', '🧾', '🔁',
      '💵', '📉', '💸', '🛡️', '🏷️', '⚖️', '🏧', '🔒',
    ],
  },
  {
    id: 'family',
    label: 'Family & Giving',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐾', '👶', '🧸', '🤲', '💐', '🛕',
      '🎂', '👪', '🎈', '❤️', '🕊️', '🎉', '💒', '🍼',
    ],
  },
] as const;

/** Default quick-pick emojis shown in simple picker grids. */
export const POPULAR_CATEGORY_ICONS: readonly string[] = [
  '🛒', '🍽️', '🚕', '⛽', '🛍️', '💡', '🏠', '💊',
  '🎬', '📚', '✈️', '💇', '🔁', '📈', '💰', '🏋️',
  '🐶', '☕', '🎮', '💻', '👕', '🧹', '🍕', '🍼',
];
