import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import "../global.css";
import { Slot, Stack } from "expo-router";
import { Fragment } from "react";
import { StatusBar } from "expo-status-bar";
import React from "react";

export default function Layout() {
	return (
    <Stack screenOptions={{
      contentStyle: {
        backgroundColor: "#16415A"
      }
    }}/>
    
	);
}
