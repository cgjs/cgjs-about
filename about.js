#!/usr/bin/env gjs

/*! (c) 2017 Andrea Giammarchi - @WebReflection (ISC) */

const OPTIONS = [];
const ARGUMENTS = [];
ARGV.forEach(arg => {
  if (/^-/.test(arg)) {
    OPTIONS.push(arg);
  } else {
    ARGUMENTS.push(arg);
  }
});

const NO_ARGUMENTS = OPTIONS.includes('--no-arguments');
const gi = imports.gi;
const GIRepository = gi.GIRepository;
const InfoType = GIRepository.InfoType;
const rep = GIRepository.Repository.get_default();
const namespaces = rep.get_loaded_namespaces();
let env = {};

if (ARGUMENTS.length) {
  if (ARGUMENTS[0] === 'gi') {
    print('');
    print(dim('available namespaces'));
    print(showList(namespaces.sort()));
    print('');
  } else {
    const path = ARGUMENTS[0].replace(/^gi\./, '').split('.');
    if (namespaces.includes(path[0])) {
      namespaceWalker(env, path[0]);
      while (path.length) {
        env = (function find(env, key, type) {
          for (let k in env) {
            if (k === key) return {
              [singular(type)]: {
                [ARGUMENTS[0]]: env[key]
              }
            };
            else if (typeof env[k] === 'object' && env[k]) {
              const found = find(env[k], key, k);
              if (found) return found;
            }
          }
        }(env, path.shift(), 'namespace'));
      }
      if (OPTIONS.includes('--json')) {
        print(JSON.stringify(env, null, '  '));
      } else {
        prettyPrint(env);
      }
    }
  }
} else if (OPTIONS.includes('--json')) {
  namespaces.forEach(name => {
    namespaceWalker(env, name);
  });
  print(JSON.stringify(env, null, '  '));
} else {
  print(`
${dim('usage:')} ${bold('cgjs-about info [options]')}
${dim('utility to query GJS namespaces')}

cgjs-about gi                 ${dim('# show all namespaes')}
cgjs-about gi.Gio             ${dim('# show all gi.Gio info')}
cgjs-about Gio                ${dim('# same as above')}
cgjs-about Gtk.Button         ${dim('# show Gtk.Button class info')}
cgjs-about GLib.utf8_validate ${dim('# show utf8_validate info')}
cgjs-about GLib enums         ${dim('# show GLib enums')}

${dim('options:')}
  --json                      ${dim('# print JSON output')}
  --no-arguments              ${dim('# print JSON without arguments info')}
`);
}

function singular(name) {
  switch (name) {
    case 'namespace': return name;
    case 'classes': return 'class';
    case 'properties': return 'property';
    default: return name.slice(0, -1);
  }
}

function walkThrough(nmsp, info) {
  const name = info.get_name();
  switch(info.get_type()) {
    case InfoType.FUNCTION:
      if (GIRepository.callable_info_is_method(info)) {
        (nmsp.methods || (nmsp.methods = {}))[name] = functionWalker(info);
      } else {
        (nmsp.functions || (nmsp.functions = {}))[name] = functionWalker(info);
      }
      break;
    case InfoType.CALLBACK:
      (nmsp.callbacks || (nmsp.callbacks = {}))[name] = functionWalker(info);
      break;
    case InfoType.STRUCT:
      (nmsp.structs || (nmsp.structs = {}))[name] = structWalker(info);
      break;
    case InfoType.ENUM:
      (nmsp.enums || (nmsp.enums = {}))[name] = enumWalker(info);
      break;
    case InfoType.FLAGS:
      (nmsp.flags || (nmsp.flags = [])).push(name);
      break;
    case InfoType.OBJECT:
      (nmsp.classes || (nmsp.classes = {}))[name] = objectWalker(info);
      break;
    case InfoType.INTERFACE:
      (nmsp.interfaces || (nmsp.interfaces = {}))[name] = interfaceWalker(info);
      break;
    case InfoType.CONSTANT:
      (nmsp.constants || (nmsp.constants = [])).push(name);
      break;
    case InfoType.VALUE:
      nmsp[name.toUpperCase()] = GIRepository.value_info_get_value(info);
      break;
    case InfoType.SIGNAL:
      (nmsp.signals || (nmsp.signals = [])).push(name);
      break;
    case InfoType.PROPERTY:
      (nmsp.properties || (nmsp.properties = [])).push(name);
      break;
    case InfoType.FIELD:
      (nmsp.fields || (nmsp.fields = {}))[name] = fieldWalker(info);
      break;
  }
}

function functionWalker(info) {
  const length = GIRepository.callable_info_get_n_args(info);
  if (NO_ARGUMENTS) return length;
  const out = {
    returns: !GIRepository.callable_info_may_return_null(info),
    params: []
  };
  for (let i = 0; i < length; i++) {
    const arg = GIRepository.callable_info_get_arg(info, i);
    out.params.push({
      name: arg.get_name(),
      null: GIRepository.arg_info_may_be_null(arg),
      optional: GIRepository.arg_info_is_optional(arg),
    });
  }
  return out;
}

function structWalker(info) {
  const out = {};
  let length = GIRepository.struct_info_get_n_methods(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.struct_info_get_method(info, i));
  }
  length = GIRepository.struct_info_get_n_fields(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.struct_info_get_field(info, i));
  }
  return out;
}

function enumWalker(info) {
  const out = {};
  let length = GIRepository.enum_info_get_n_methods(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.enum_info_get_method(info, i));
  }
  length = GIRepository.enum_info_get_n_values(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.enum_info_get_value(info, i));
  }
  return out;
}

function interfaceWalker(info) {
  const out = {};
  let length = GIRepository.interface_info_get_n_constants(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.interface_info_get_constant(info, i));
  }
  length = GIRepository.interface_info_get_n_methods(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.interface_info_get_method(info, i));
  }
  length = GIRepository.interface_info_get_n_prerequisites(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.interface_info_get_prerequisite(info, i));
  }
  length = GIRepository.interface_info_get_n_properties(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.interface_info_get_property(info, i));
  }
  length = GIRepository.interface_info_get_n_signals(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.interface_info_get_signal(info, i));
  }
  length = GIRepository.interface_info_get_n_vfuncs(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.interface_info_get_vfunc(info, i));
  }
  return out;
}

function objectWalker(info) {
  const out = {};
  let length = GIRepository.object_info_get_n_constants(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.object_info_get_constant(info, i));
  }
  length = GIRepository.object_info_get_n_methods(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.object_info_get_method(info, i));
  }
  length = GIRepository.object_info_get_n_properties(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.object_info_get_property(info, i));
  }
  length = GIRepository.object_info_get_n_signals(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.object_info_get_signal(info, i));
  }
  length = GIRepository.object_info_get_n_vfuncs(info);
  for (let i = 0; i < length; i++) {
    walkThrough(out, GIRepository.object_info_get_vfunc(info, i));
  }
  return out;
}

function fieldWalker(info) {
  return GIRepository.field_info_get_flags(info);
}

function namespaceWalker(env, Namespace) {
  const nmsp = (env[Namespace] = {});
  const length = rep.get_n_infos(Namespace);
  for (let i = 0; i < length; i++) {
    walkThrough(nmsp, rep.get_info(Namespace, i));
  }
}

function bold(str) {
  return `\x1b[1m${str}\x1b[0m`;
}

function dim(str) {
  return `\x1b[2m${str}\x1b[0m`;
}

function prettyPrint(json) {
  for (const key in json) {
    for (const sub in json[key]) {
      const out = [];
      const info = json[key][sub];
      switch (key) {
        case 'namespace':
          out.push(showNamespace(info, key, sub));
          break;
        case 'enum':
          out.push(`${dim(key)} ${bold(sub)} {`);
          Object.keys(info).forEach(key => {
            out.push(`\n  ${key}: ${dim(info[key])}`);
          });
          out.push(`\n}`);
          break;
        case 'interface':
        case 'class':
          out.push(`${dim(key)} ${bold(sub)} {`);
          if (info.signals) {
            out.push(`\n  ${dim('#signals')} = [${info.signals.join(', ')}];`);
            out.push('\n');
          }
          (info.constants || []).forEach(c => {
            out.push(`\n  ${dim('static')} ${c};`);
          });
          for (const k in (info.functions || {})) {
            out.push(`\n  ${dim('static')} ${k}`);
            out.push(inlineArguments(info.functions[k]));
            out.push(' {}');
          }
          if (info.functions) {
            if (info.functions.new) {
              out.push(`\n\n  constructor(options:Object) {}`);
            }
            out.push('\n\n  ' + dim('// methods'));
          }
          for (const k in (info.methods || {})) {
            out.push(`\n  ${k}`);
            out.push(inlineArguments(info.methods[k]));
            out.push(' {}');
          }
          if (info.properties) {
            out.push('\n\n  ' + dim('// properties'));
            out.push(showList(info.properties), '; ');
          }
          out.push(`\n}`);
          break;
        case 'method':
        case 'function':
          if (key === 'function') {
            out.push(`${dim(key)} ${bold(sub)}`);
          } else {
            out.push(`${sub.slice(0, sub.lastIndexOf('.'))}.prototype.${bold(sub.slice(sub.lastIndexOf('.') + 1))}`);
          }
          out.push(parseArguments(info));
          break;
      }
      print('');
      print(out.join(''));
      print('');
    }
  }
}

function inlineArguments(info) {
  return parseArguments(info).replace(/\n\s*/g, '').replace(/,(\S)/g, ', $1');
}

function parseArguments(info) {
  const out = ['('];
  if (typeof info === 'number') {
    if (info) out.push(`${info} parameter${info === 1 ? '' : 's'}`);
  } else {
    info.params.forEach((arg, i) => {
      if (i) out.push(',');
      if (arg.optional) {
        out.push('\n  ', dim(arg.name));
        if (arg.null) out.push(dim('|null'));
        out.push(dim('?'));
      } else {
        out.push('\n  ', arg.name);
        if (arg.null) out.push(dim('|null'));
      }
    });
    if (info.params.length) out.push('\n');
  }
  out.push(`)${dim(':any' + (info.returns ? '' : '|null'))}`);
  return out.join('');
}

function showList(list, sep = ', ', nl = '\n  ', perLine = 5) {
  const out = [];
  const length = list.length;
  for (let i = 0; i < length; i++) {
    if (!(i % perLine)) out.push(nl);
    out.push(list[i], dim(sep));
  }
  out.pop();
  return out.join('');
}

function showNamespace(info, key, sub) {
  const out = [];
  const args = ARGUMENTS.slice(1);
  let keys = Object.keys(info);
  if (args.some(arg => keys.includes(arg))) {
    keys = keys.filter(key => args.includes(key));
  } else if (args.length) return `${dim(key)} ${bold(sub)} has no ${args.join(', ')}`;
  out.push(`${dim(key)} ${bold(sub)}`);
  keys.forEach(key => {
    let list;
    switch (key) {
      case 'methods':
      case 'functions':
        list = Object.keys(info[key]);
        out.push(`\n\n  ${dim(key)} ${list.length}${showList(list, '', '\n  ', 1)}`);
        break;
      case 'interfaces':
      case 'classes':
      case 'enums':
      case 'callbacks':
        list = Object.keys(info[key]);
        out.push(`\n\n  ${dim(key)} ${list.length}${showList(list)}`);
        break;
      case 'structs':
        const structs = Object.keys(info[key]);
        list = structs.filter(name => !/Private/.test(name));
        out.push(`\n\n  ${dim(key)} ${structs.length} ${
          dim(`(${structs.length - list.length} privates)`)
        }${showList(list)}`);
        break;
      case 'flags':
        list = info[key];
        out.push(`\n\n  ${dim(key)} ${list.length}${showList(list)}`);
        break;
    }
  });
  return out.join('');
}