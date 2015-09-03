var htmlparser = require('htmlparser2')
var indentString = require('indent-string')

var buffer = []
var indent = 0
var endBraces = {}
var isText = false

function flush () {
  buffer.length = 0
  indent = 0
  endBraces = {}
  isText = false
}

function strify (str) {
  return '"' + (str || '') + '"'
}

function write (line) {
  var str = indentString(line, ' ', indent * 2)
  buffer.push(str)
  return line
}

function writeln (command, tag, key, spvp, pvp) {
  var str = command
  str += '(' + strify(tag)
  if (command === 'elementOpen') {
    str += key ? ', ' + strify(key) + ' + index' : ', null'
    str += spvp && spvp.length ? ', ' + JSON.stringify(spvp) : ', null'
    str += pvp && pvp.length ? ', ' + pvp.map(function (item, index) {
      return index % 2 ? item : strify(item)
    }).join(', ') : ', null'
  }
  str += ')'

  str = str.replace(', null, null, null)', ')')
  str = str.replace(', null, null)', ')')
  return write(str)
}

function getAttrs (attribs) {
  var specialPropertyMap = {}
  var staticPropertyValuePairs = []
  var propertyValuePairs = []

  for (var key in attribs) {
    if (key && key.substr(0, 3) === 'ui-') {
      if (key === 'ui-text' || key === 'ui-for' || key === 'ui-if') {
        specialPropertyMap[key] = attribs[key]
      } else {
        propertyValuePairs.push(key.substr(3))
        propertyValuePairs.push(attribs[key])
      }
    } else {
      staticPropertyValuePairs.push(key)
      staticPropertyValuePairs.push(attribs[key])
    }
  }
  return {
    specialPropertyMap: specialPropertyMap,
    staticPropertyValuePairs: staticPropertyValuePairs,
    propertyValuePairs: propertyValuePairs
  }
}

var handler = {
  onopentag: function (name, attribs) {
    console.log('onopentag', name, attribs)
    isText = false
    if (name === 'ui-text') {
      isText = true
      return
    }
    var attrs = getAttrs(attribs)
    var specialProps = attrs.specialPropertyMap
    var key

    if (specialProps['ui-if']) {
      endBraces[name + '_' + indent] = '}'
      write('if (' + specialProps['ui-if'] + ') {')
      ++indent
    }
    if (specialProps['ui-for']) {
      key = specialProps['ui-for']
      var forAttr = specialProps['ui-for']
      var forParts = forAttr.split(' in ')
      endBraces[name + '_' + indent] = '}, ' + forParts[1] + ')'
      write(';(Array.isArray(' + forParts[1] + ') ? ' + forParts[1] + ' : Object.keys(' + forParts[1] + ')' + ').forEach(function(' + forParts[0] + ', index) {')
      ++indent
    }

    writeln('elementOpen', name, key, attrs.staticPropertyValuePairs, attrs.propertyValuePairs)

    ++indent

    if (specialProps['ui-text']) {
      write('text(' + specialProps['ui-text'] + ')')
    }
  },
  ontext: function (text) {
    console.log('text', text)
    if (!text || !text.trim()) {
      return
    }
    write('text(' + (isText ? text : strify(text)) + ')')
  },
  onclosetag: function (name) {
    console.log('onclosetag', name)
    if (name === 'ui-text') {
      isText = false
      return
    }

    --indent
    writeln('elementClose', name)

    var endBraceKey = name + '_' + (indent - 1)

    if (endBraces[endBraceKey]) {
      var end = endBraces[endBraceKey]
      delete endBraces[endBraceKey]
      --indent
      write(end)
    }
  }
}

module.exports = function (tmplstr) {
  flush()

  var parser = new htmlparser.Parser(handler, {
    decodeEntities: true
  })

  parser.write(tmplstr)
  parser.end()

  var result = buffer.join('\n')

  flush()

  return result
}
