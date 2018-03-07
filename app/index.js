const Regular = require( 'regularjs' )
const axios = require( 'axios' )
const debounce = require( 'lodash.debounce' )
const Base64 = require( 'js-base64' ).Base64
const blobToBuffer = require( 'blob-to-buffer' )
const fs = require( 'fs' )
const { nativeImage, clipboard, ipcRenderer } = require('electron')

const PRESETS = [
  { keyword: '大家都在发', tid: -1 },
  { keyword: '喵星人的日常', tid: 1057 },
  { keyword: '家有汪星人', tid: 3270 },
  { keyword: '萌娃民国', tid: 772 },
  { keyword: '权律二', tid: 2978 },
  { keyword: '贱贱蘑菇头', tid: 957 },
  { keyword: '逗比图集', tid: 4014 },
]

const DEFAULT_KEYWORD = PRESETS[ 0 ].keyword
const DEFAULT_TID = PRESETS[ 0 ].tid

const App = Regular.extend( {
  template: `
    <div class="actionbox">
      <div class="searchbox">
        <input ref="input" autofocus class="search" type="text" on-input="{ this.onKwChange($event) }" />
        <div class="search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
      </div>

      <div class="presets">
        {#list presets as preset}
          <div class="preset { tid === preset.tid ? 'is-selected' : '' }" on-click="{ this.onSwitchPreset( preset.keyword, preset.tid ) }">{ preset.keyword }</div>
        {/list}
      </div>
    </div>

    <div class="stickers">
      {#list stickers as sticker}
        <div class="sticker" style="background-image: url({ sticker.url })" on-click="{ this.onCopy( sticker.url, sticker_index ) }">
          {#if copiedMap[ sticker_index ]}
          <div class="copied-tip">
            <div class="center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <div>已复制</div>
            </div>
          </div>
          {/if}

          {#if copyErrorMap[ sticker_index ]}
          <div class="copied-tip">
            <div class="center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              <div>不支持gif</div>
            </div>
          </div>
          {/if}
        </div>
      {/list}
    </div>

    <div class="footer">
      <div></div>
      <div class="right">
        <div class="options" on-click="{ this.onShowOptionsMenu( $event ) }">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="19" viewBox="0 0 19 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-menu"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </div>
      </div>
    </div>
  `,
  config() {
    this.data.copiedMap = {}
    this.data.copyErrorMap = {}
    this.data.stickers = []
    this.data.kw = DEFAULT_KEYWORD
    this.data.tid = -1
    this.data.page = 1
    // type = 0 表示自定义搜索 -> type
    this.data.type = 1
    // tid 特定类目id
    this.onKwChange = debounce( this.onKwChange.bind( this ), 100 )
    this.data.presets = PRESETS

    // 默认载入特定类目表情
    this.loadStickers()
  },
  init() {
    window.addEventListener( 'scroll', () => {
      const remainingHeight = document.body.scrollHeight - document.body.scrollTop - window.innerHeight
      // 剩余高度小于一屏，开始加载
      if ( remainingHeight < window.innerHeight ) {
        this.data.page = this.data.page + 1
        this.loadStickers()
      }
    } )

    ipcRenderer.on( 'focus-search-input', () => {
      this.$refs.input.focus()
    } )
  },

  loadStickers() {
    if ( this.data.type === 0 ) {
      return this.searchStickers( {
        kw: this.data.kw,
        page: this.data.page,
      } )
    } else if ( this.data.type === 1 ) {
      return this.loadPresetStickers( {
         kw: this.data.kw,
         page: this.data.page,
         tid: this.data.tid,
      } )
    }
  },

  // tid 特定分类
  searchStickers( { kw = '', page = 1 } = {} ) {
    kw = this.encode( kw )

    axios.get( `http://config.pinyin.sogou.com/macpicface/interface/query_dt.php?cands=${ kw }&tp=0&page=${ page }` )
      .then( res => res.data )
      .then( json => {
        if ( Array.isArray( json.imglist ) && json.imglist.length > 0 ) {
          this.data.stickers.push( ...this.postFilter( json.imglist ) )
          this.$update()
        }
      } )
  },

  loadPresetStickers( { kw = '', page = 1, tid } = {} ) {
    kw = this.encode( kw )

    axios.get( `http://config.pinyin.sogou.com/macpicface/interface/query_dt.php?cands=${ kw }&tp=1&page=${ page }&tid=${ tid }` )
      .then( res => res.data )
      .then( json => {
        if ( Array.isArray( json.imglist ) && json.imglist.length > 0 ) {
          this.data.stickers.push( ...this.postFilter( json.imglist ) )
          this.$update()
        }
      } )
  },

  onSwitchPreset( keyword, tid ) {
    this.data.type = 1
    this.data.page = 1
    this.data.kw = keyword
    this.data.tid = tid
    this.data.stickers.length = 0

    this.scrollToTop()
    this.loadStickers()
  },

  scrollToTop() {
    document.body.scrollTop = 0
  },

  postFilter( imglist ) {
    // return imglist
    // 排除gif
    return imglist.filter( img => !img.url.endsWith( 'gif' ) )
  },

  // 关键词encode
  encode( kw ) {
    kw = Base64.encode( kw )
    kw = kw.replace( /\+/g, '_' )
    kw = kw.replace( /[a-zA-Z]/g, (m) => {
      if ( /[a-z]/.test( m ) ) {
        return m.toUpperCase()
      } else {
        return m.toLowerCase()
      }
    } )
    return kw
  },

  onKwChange( e ) {
    const value = e.event.target.value

    // 重置
    if ( !!value ) {
      this.data.kw = String( value )
      this.data.type = 0
    } else {
      this.data.kw = DEFAULT_KEYWORD
      this.data.tid = DEFAULT_TID
      this.data.type = 1
    }
    this.data.page = 1
    this.data.stickers.length = 0

    this.scrollToTop()

    this.loadStickers( {
      kw: this.data.kw,
      page: this.data.page,
    } )
  },

  onCopy( url, index ) {
    axios.get( url, {
      responseType: 'blob'
    } ).then( response => {
      console.log( response )
      if ( response.headers[ 'content-type' ].toLowerCase() === 'image/gif' ) {
        // 不支持复制gif
        this.data.copyErrorMap[ index ] = true
        this.$update()
        setTimeout( () => {
          this.data.copyErrorMap[ index ] = false
          this.$update()
        }, 1000 )
      } else {
        blobToBuffer( response.data, ( err, buffer ) => {
          // 写入剪贴板
          const img = nativeImage.createFromBuffer( buffer )
          clipboard.writeImage( img )

          this.data.copiedMap[ index ] = true
          this.$update()

          setTimeout( () => {
            this.data.copiedMap[ index ] = false
            this.$update()
            ipcRenderer.send( 'hide-menubar-window' )
          }, 300 )
        } )
      }
    } )
  },

  onShowOptionsMenu( e ) {
    e.event.stopPropagation()

    const target = e.event.target
    const { left, bottom } = target.getBoundingClientRect()
    ipcRenderer.send( 'show-options-menu', {
      x: left,
      y: bottom,
    } )
  }
} )

new App()
  .$inject( document.getElementById( 'app' ) )
