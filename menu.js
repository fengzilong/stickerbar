const AutoLaunch = require( 'auto-launch' )
const { app, Menu } = require( 'electron' )
const pkg = require( './package.json' )

const launcher = new AutoLaunch( {
  name: pkg.productName,
} )

app.setAboutPanelOptions( {
  applicationName: pkg.productName,
  copyright: pkg.author.email,
  applicationVersion: pkg.version,
  version: pkg.version,
} )

module.exports = function buildMenu() {
  return launcher.isEnabled()
    .then( isEnabled => {
      return Menu.buildFromTemplate([
        {
          role: 'about'
        },

        {
          type: 'separator'
        },

        {
          label: 'Launch at login',
          type: 'checkbox',
          checked: isEnabled,
          click() {
            launcher.isEnabled()
              .then( ret => {
                if ( ret ) {
                  launcher.disable()
                } else {
                  launcher.enable()
                }
              } )
          }
        },

        {
          type: 'separator'
        },

        {
          role: 'quit',
          accelerator: 'Cmd+Q'
        }
      ])
    } )
}
