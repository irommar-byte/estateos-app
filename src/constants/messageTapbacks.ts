/** Klasyczny zestaw Tapbacków jak w iMessage. */
export const MESSAGE_TAPBACKS = ['❤️', '👍', '👎', '😂', '😮', '‼️', '❓'] as const;

export type MessageTapback = (typeof MESSAGE_TAPBACKS)[number];
