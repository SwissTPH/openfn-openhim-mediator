const {
    verify,
    wrapRootExpressions,
    callFunction,
    wrapIIFE,
} = require('./compile/transforms');
const {
    modulePath,
    getModule,
    writeJSON,
    formatCompileError,
} = require('./utils');

const Compile = require('./compile');
const Execute = require('./execute');

const { VM } = require('vm2');

const globals = new VM({}).run(
    `Object.getOwnPropertyNames(this).reduce((obj, item) => {
    obj[item] = this[item];
    return obj;
  }, {});`
);

function Prepare(state, expression, language, output=null){
    console.log("Preparation started..........")
    const f = require('fs');
    let adaptVersion;
    const lan_path = `./languages/${language}.Adaptor`
    const Adaptor = getModule(modulePath(lan_path));
    const extensions = Object.assign(
        {
            setTimeout // We allow as Erlang will handle killing long-running VMs.
        },
        Adaptor
    );
    try {
        console.log("first try entered")
        // Assign extensions which will be added to VM2's sandbox, used by both Execute
        // and the `verify` transform in Compile.
        const rawdata = f.readFileSync(
            lan_path.substring(0, lan_path.lastIndexOf('Adaptor') - 1) + '/package.json'
        );
        const package = JSON.parse(rawdata);
        adaptorVersion = `${package.name}#v${package.version}`;
    } catch (error) {
        adaptorVersion = lan_path;
    }

    const debug_prep = `│ ◰ ◱ ◲ ◳  OpenFn/core ~ ${adaptVersion} (Node ${process.version}) │`;
    console.log('╭' + '─'.repeat(debug_prep.length - 2) + '╮');
    console.log(debug_prep);
    console.log('╰' + '─'.repeat(debug_prep.length - 2) + '╯');

    try {
        console.log("entered try statement")
        const transforms = [
            verify({ sandbox: Object.assign(globals, extensions) }),
            wrapRootExpressions('execute'),
            callFunction('execute', 'state'),
            // TODO: wrap in Promise IIFE, to ensure Executes interface is
            // always the same - conforming all errors.
            wrapIIFE(),
        ];

        console.log(state)
        console.log("-------------")
        const compile = new Compile(expression, transforms);
        if (compile.errors.length > 0) {
            compile.errors
                .map(error => {
                    return formatCompileError(expression, error);
                })
                .map(error => {
                    console.log(error);
                });

            return new Error('Compilation failed.')
        }
        code = compile.toString()

        // Break comment if you want to see the expression prior to execution.
        console.log(code)
        console.log("-------------")
        Execute({ code, state, extensions })
            .then(state => {
                // TODO: stat path and check is writable before running expression
                if (output) {
                    return writeJSON(output, state);
                }
                return state;
            })
            .then(state => {
                console.log('Finished.');
                process.exitCode = 0;
            })
            .catch(err => {
                process.exitCode = 1;
                return Promise.reject(err);
            })
    } catch (e) {
        console.error(e);
        process.exitCode = 10;
    }
}

module.exports = Prepare;
