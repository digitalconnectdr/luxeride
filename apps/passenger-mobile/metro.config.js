// ── Config de Metro para monorepo ──────────────────────────────────────────
// Mismo problema y mismo fix que apps/driver-mobile/metro.config.js: el repo
// tiene dos copias de React (18.3.1 en la raíz, para apps/web; 19.1.0 local
// aquí, la que exige Expo SDK 54). npm hoistea a la raíz cualquier
// dependencia de esta app sin conflicto de versión, y esos paquetes
// hoisteados terminan resolviendo "react" desde la raíz (18.x) en vez de la
// copia local (19.x) que realmente renderiza la app, rompiendo el
// dispatcher de hooks. Se intercepta SOLO "react" y sus subpaths para
// forzar que siempre resuelvan a la copia local.

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
