import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import "../global.css";
import { Slot, Stack } from "expo-router";
import { Fragment } from "react";
import { StatusBar } from 'expo-status-bar'

export default function Layout() {
	return (
           <Fragment>
           <StatusBar style="auto" />
			{/* <SafeAreaView className="h-screen-safe"> */}
			<Stack screenOptions={{
      }}/>
			{/* </SafeAreaView > */}
           </Fragment>
	);
}
