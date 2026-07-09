// ── Config de Metro para monorepo ──────────────────────────────────────────
// El repo tiene DOS copias de React (18.3.1 en la raíz, para apps/web;
// 19.1.0 local aquí, la que exige Expo SDK 54). npm hoistea a la raíz
// cualquier dependencia de esta app que no tenga conflicto de versión ahí
// (ya pasó con @react-navigation/core, @react-navigation/routers y los
// paquetes de fuentes @expo-google-fonts/*) — y esos paquetes hoisteados
// terminan resolviendo "react" desde la raíz (18.x) en vez de la copia local
// (19.x) que realmente está renderizando la app, rompiendo el dispatcher de
// hooks ("Cannot read property 'useState'/'useContext' of null").
//
// En vez de deshabilitar la búsqueda jerárquica de Metro (rompe la
// resolución normal de sub-dependencias anidadas, como expo-asset dentro de
// expo/node_modules), se intercepta SOLO "react" y sus subpaths para forzar
// que siempre resuelvan a la copia local, sin importar desde qué carpeta se
// pida. Todo lo demás sigue el resolver por defecto de Metro.

const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

const FORCE_LOCAL_REACT = new Set(['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'scheduler'])

const originalResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (FORCE_LOCAL_REACT.has(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    }
  }
  if (originalResolveRequest) return originalResolveRequest(context, moduleName, platform)
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
