// https://github.com/sky-Neverland/vue-css-to-json/blob/main/json-validator.js
// @sky-Neverland

function httpGet(theUrl){
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.open( "GET", theUrl, false ); // false for synchronous request
  xmlHttp.send( null );
  return xmlHttp.responseText;
}

// Theme data
const allThemes = httpGet(THEME_URL);

// list all keys of `allThemes`
function getKeys(obj) {
  const stack = [[obj, ""]];
  const res = [];
  while (stack.length) {
    const crtRaw = stack.pop();
    const crt = crtRaw[0];
    const crtPath = crtRaw[1];
    if (window.JSON.stringify(crt).includes('{')) {
      const entries = window.Object.entries(crt);
      let i = entries.length;
      while (i--) {
        const key = entries[i][0];
        const value = entries[i][1];
        const path = crtPath ? `${crtPath}.${key}` : key;
        stack.push([value, path]);
      }
    } else {
      res.push(crtPath);
    }
  }
  return res;
}

// css to json
function getStyles(sty) {
  var output = {};
  
  // dash separated string to camel case
  var camelize = function camelize(str) {
    return str.replace (/(?:^|[-])(\w)/g, function (a, c) {
      c = a.substr(0, 1) === '-' ? c.toUpperCase () : c;
      return c ? c : '';
    });
  };
    
  // Remove comments: /*...*/ or //...
  var style = sty.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g,'').split('\n');

  for (var i = 0; i < style.length; ++i) {
    var rule = style[i].trim();
    
    // `key` : `value` ;
    if (rule.endsWith(';')) {
      var ruleParts = rule.slice(0, -1).split(':');
        if (ruleParts.length === 2){
          var key = camelize(ruleParts[0].trim());
          output[key] = ruleParts[1].trim();
        }
    }
    
    // `className` { ... }
    else if(rule.includes('{')){  // Match nested "{}"
      var bracketsToMatch = 1;
      var parentKey = rule.split('{')[0].trim();
      var innerCss = '';
      for (var j = i + 1; j < style.length; ++j){
        innerCss += style[j].trim() + '\n';
        bracketsToMatch += style[j].split('{').length - style[j].split('}').length;
        if (bracketsToMatch <= 0){
          break;
        }
      }
      if (bracketsToMatch > 0){
        throw new Error('Error: Missing "}".');
      }
      if (innerCss.endsWith('}\n')) innerCss=innerCss.slice(0, -2); // Remove '}\n'
      output[parentKey]=JSON.parse(getStyles(innerCss)); 
      i = j;
    }
  }
  return window.JSON.stringify(output, null, 2);
}
const Fieldtype = {
  mixins: [window.Storyblok.plugin],
  template: 
  `<div>
    <p> Raw Css: <p>
    <div class="uk-flex" @keydown.up="up" @keydown.down="down">
      <textarea ref="cssText" rows='8' class="uk-width-1-1 uk-margin-right" v-model="model.css"
        @keydown.shift.enter.prevent="convert" @keyup="hint" @click="hint"
        @keydown.tab.prevent="complete" @keyup.tab.prevent="replaceCursor(); hint();"/>
      <div :style="{'max-width':'80px', 'max-height':'250px', 'overflow-x':'visible'}" >
        <div class="uk-height-1-1" :style="{'overflow-y':'auto'}">
          <a v-for="(key, index) in theme" :key=index
            @click="complete(); hint(); $refs.cssText.focus();" @mouseover="select=index">
            <p :class="{'uk-text-warning' : index === select}" ref="themeKeys">
              {{ /* For better overflow wrap, insert white space in camel case */ }}
              {{ key.replace(/([a-z0-9])([A-Z])/g, "$1\u200B$2") }}
            </p>
          </a>
        </div>
      </div>
    </div>
    <div class="uk-flex uk-margin">
      <button class="uk-margin-right" @click="convert"> Convert </button> 
      <span class="uk-text-muted"> (Shortcut: Shift + Enter) </span>
    </div>
    <p class="uk-alert-danger" v-if="showValidation && model.error">{{ model.error }}</p>
    <p class="uk-alert-success" v-if="showValidation && !model.error"> Valid CSS ✔ </p>
    <p> Output Json: </p>
    <textarea ref="jsonText" rows='8' class="uk-width-1-1" v-model="model.json" @blur="check" @focus="onFocus"/>
    <p class="uk-text-muted"> In case conversion does not meet expectations, it can be modified here </p>
    <button @click="format"> Prettier </button>
  </div>`,
  data() {
    return {
      theme: [],
      select: 0,
      showValidation: false,
      cursorPos: 0
    };
  },
  methods: {
    initWith() {
      return {
        css: '',
        plugin: 'json-validator',
        json: '',
        error: ''
      };
    },
    up() {
      if (this.theme.length > 1) {
        event.preventDefault();
        const len = this.theme.length;
        this.select = (this.select - 1 + len) % len;
        this.$refs.themeKeys[this.select].scrollIntoView({block: "nearest"});
      }
    },
    down() {
      if (this.theme.length > 1) {
        event.preventDefault();
        this.select = (this.select + 1) % this.theme.length;
        this.$refs.themeKeys[this.select].scrollIntoView({block: "nearest"});
      }
    },
    getInput(text, ref){
      const splitReg = /[^a-zA-Z0-9\.]/g;
      const index = text.slice(0, ref.selectionEnd).split(splitReg).length -1;
      return text.split(splitReg)[index];
    },
    complete() {
      const textarea = this.$refs.cssText;
      const text = this.model.css;
      const input = this.getInput(text, textarea);
      const inputKey = input.split('.').pop();
      const key = this.theme.length > this.select ? this.theme[this.select] : '';
      const len = text.slice(textarea.selectionEnd).search(/[^a-zA-Z0-9\.]/);
      textarea.selectionEnd += len > -1 ? len : text.slice(textarea.selectionEnd).length;
      const posi = textarea.selectionEnd;
      this.model.css = text.slice(0, posi) + key.replace(inputKey, '') + text.slice(posi);
      this.cursorPos = posi + key.replace(inputKey, '').length;
      this.select = 0;
    },
    replaceCursor(){
      this.$refs.cssText.selectionEnd = this.cursorPos;
    },
    onFocus() {
      this.showValidation = false;
    },
    hint() {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown'){
        return; 
      }
      const keys = [];
      const input = this.getInput(this.model.css, this.$refs.cssText);
      const inputKeys = input.split('.');
      const themeObj = {"theme":JSON.parse(allThemes)};
      const keywords = getKeys(themeObj);
      keywords.map((keyword) => {
        if (keyword.startsWith(input)) {
          const key = keyword.split('.')[inputKeys.length - 1];
          if (keys.indexOf(key) < 0){
            keys.push(key);
          }
        }
      });
      if (keys.length <= 1 && keys[0] === inputKeys.pop()) this.theme = [];
      else this.theme = keys;
      this.select = 0;
    },
    convert() {
      try {
        this.model.json = getStyles(this.model.css);
        this.format();
      }
      catch(e) {
        this.model.error = e.message;
        this.showValidation = true;
      }
    },
    check() {
      this.model.error = '';
      let jsonValue = '';
      try {
          jsonValue = JSON.parse(this.model.json);
      }
      catch(e) {
        this.model.error = e.message;
        const textarea = this.$refs.jsonText;
        if (this.model.error.indexOf('position') > -1) {
          // highlight error position
          const positionStr = this.model.error.lastIndexOf('position') + 8;
          const posi = parseInt(this.model.error.substr(positionStr, this.model.error.length));
          if (posi >= 0) {
            textarea.focus();
            textarea.setSelectionRange(posi, posi + 1);
          }
        }
      }
      this.showValidation = true;
    },
    format() {
      this.check();
      if (!this.model.error) {
        this.model.json=window.JSON.stringify(JSON.parse(this.model.json), null, 2);
      }
    }
  },
  watch: {
    'model': {
      handler: function (value) {
        this.$emit('changed-model', value);
      },
      deep: true
    }
  }
};
