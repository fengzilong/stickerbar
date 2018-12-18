'use strict';

const path = require( 'path' )
const electron = require( 'electron' )
const { ipcMain } = electron
const buildMenu = require( './menu' )

const app = electron.app

// Adds debug features like hotkeys for triggering dev tools and reload
require( 'electron-debug' )()

var menubar = require( 'menubar' )

var mb = menubar( {
  height: 570,
  preloadWindow: true,
  dir: path.join( __dirname, 'app' )
  // alwaysOnTop: true,
} )

mb.on('ready', () => {
  console.log( 'app is ready' )
})

mb.on( 'after-show', () => {
  mb.window.webContents.send( 'focus-search-input' )
} )

ipcMain.on( 'hide-menubar-window', ( event, arg ) => {
  mb.hideWindow()
} )

ipcMain.on( 'show-options-menu', ( event, coordinates ) => {
  if ( coordinates && coordinates.x && coordinates.y ) {
    coordinates.x = parseInt( coordinates.x.toFixed(), 10 )
    coordinates.y = parseInt( coordinates.y.toFixed(), 10 )

    buildMenu().then( menu => {
      menu.popup( coordinates.x + 4, coordinates.y )
    } )
  }
} )
