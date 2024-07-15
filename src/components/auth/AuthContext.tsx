import { type Dispatch, createContext, useContext, useReducer } from "react";
import type { AuthState } from "./types";

type AuthTitle = {
	[key in AuthState]: string;
};

export const AuthTitleCopy: AuthTitle = {
	signIn: "Sign In",
	signUp: "Sign Up",
	resetPassword: "Reset Password",
};

type Action = { type: "SET_STATE"; payload: AuthState };

type DispatchContextType = Dispatch<Action> | undefined;
const StateContext = createContext<AuthState | undefined>(undefined);
const DispatchContext = createContext<DispatchContextType>(undefined);

type Props = {
	children: React.ReactNode;
};

export const StateProvider = ({ children }: Props) => {
	const [state, dispatch] = useReducer(reducer, initialState);

	return (
		<StateContext.Provider value={state}>
			<DispatchContext.Provider value={dispatch}>
				{children}
			</DispatchContext.Provider>
		</StateContext.Provider>
	);
};

export const useStateValue = () => {
	const state = useContext(StateContext);
	if (state === undefined) {
		throw new Error("useStateValue must be used within a StateProvider");
	}
	return state;
};

export const useDispatch = () => {
	const dispatch = useContext(DispatchContext);
	if (!dispatch) {
		throw new Error("useDispatch must be used within a StateProvider");
	}
	return dispatch;
};

// Define your initial state
const initialState: AuthState = "signIn";

// Define your reducer
function reducer(state: AuthState, action: Action): AuthState {
	switch (action.type) {
		case "SET_STATE":
			return action.payload;
		default:
			return state;
	}
}
