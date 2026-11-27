import { useSyncExternalStore } from "react";
import { settings, type Settings } from "../bridge/storage";
export const useSettings = (): Settings => useSyncExternalStore(settings.subscribe, settings.get);
