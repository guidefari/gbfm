import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface UIState {
	commando: {
		isOpen: boolean;
	};
}

interface UIActions {
	openCommando: () => void;
	closeCommando: () => void;
	toggleCommando: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
	devtools(
		(set) => ({
			commando: {
				isOpen: false,
			},
			openCommando: () =>
				set(
					(state: UIStore) => ({
						commando: { ...state.commando, isOpen: true },
					}),
					false,
					"ui/commando/open",
				),
			closeCommando: () =>
				set(
					(state: UIStore) => ({
						commando: { ...state.commando, isOpen: false },
					}),
					false,
					"ui/commando/close",
				),
			toggleCommando: () =>
				set(
					(state: UIStore) => ({
						commando: { ...state.commando, isOpen: !state.commando.isOpen },
					}),
					false,
					"ui/commando/toggle",
				),
		}),
		{
			name: "ui-store",
		},
	),
);
