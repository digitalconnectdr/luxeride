import { registerRootComponent } from 'expo';

// Registra la tarea de ubicación en segundo plano ANTES que nada más — debe
// ejecutarse en todo arranque del bundle, incluido el arranque headless que
// dispara el SO en background, o expo-task-manager no la encuentra.
import './lib/backgroundLocationTask';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
