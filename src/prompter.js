const promptly = require('promptly');
const actions = require('./actions');
const chalk = require('chalk')
const argv = require('./arguments')

module.exports = {
    handleAction(action, advisories) {
        console.log(`\n--------------------------------------------------`);
        console.log(` ${chalk.bold.black.bgWhite(action.module)} needs your attention.\n`);
        const groupedResolutions = action.resolves.reduce((groups, re) => {
            groups[re.id] = groups[re.id] || [];
            let type = re.dev ? ' devDependencies' : 'dependencies';
            re.optional && (type += ' (optional)');
            re.bundled && (type += ' (bundled)');
            let reportLine = ` - ${type}: ${re.path}`;
            if (re.humanReviewStatus) {
                re.humanReviewStatus.fix &&
                (reportLine = appendWarningLine(reportLine, '^ this issue was marked as fixed earlier'));
                re.humanReviewStatus.remind &&
                (reportLine = appendWarningLine(reportLine, '^ this issue was already postponed'));
            }
            if (re.isMajor) {
                reportLine = appendWarningLine(reportLine, '! warning, fix is a major version upgrade');
            }
            groups[re.id].push(reportLine);
            
            return groups;
        }, {});
        let onlyLow = true;
        Object.keys(groupedResolutions).forEach(reId => {
            const adv = advisories[reId];
            if(adv.severity !== 'low'){
                onlyLow = false
            }
            const severityTag = getSeverityTag(adv);
            console.log(`${severityTag} ${adv.title}`);
            console.log(
                ` vulnerable versions ${adv.vulnerable_versions} found in:`
            );
            console.log(groupedResolutions[reId].join('\n'));
        });
        if(argv.ignoreLow && onlyLow){
            console.log(chalk.greenBright(` ✔ automatically ignore low severity issue`))
            return actions.takeAction('i', { action, advisories, command: null });
        }

        const command = [
            'npm',
            action.action,
            action.module + '@' + action.target,
            action.depth ? '--depth ' + action.depth : ''
        ].join(' ');

        return optionsPrompt({ action, advisories, command })
    }
};

function optionsPrompt({ action, advisories, command }, availableChoices = null) {
    const actionName = action.action;

    const choices = [
        {
            key: 'r',
            name: 'remind me in 24h'
        },
        {
            key: 'i',
            name: 'ignore paths'
        },
        {
            key: 's',
            name: 'Skip this'
        },
        {
            key: 'd',
            name: 'show more details and skip'
        },
        {
            key: 'q',
            name: 'Quit'
        }
    ];


    if (['install', 'update'].includes(actionName)) {
        choices.unshift({
            key: 'f',
            name: 'fix with ' + chalk.greenBright(command)
        });
    } else {
        choices.unshift({
            key: '?',
            name: chalk.blueBright('investigate')
        });
    }

    availableChoices = ['x', 's'].concat(availableChoices || choices.map(c => c.key))

    console.log('_');
    console.log(
        choices
            .filter(c => availableChoices.includes(c.key))
            .map(c => ` ${chalk.bold(c.key)}) ${c.name}`).join('\n')
    );

    return promptly.choose(
        'What would you like to do? ',
        choices.map(c => c.key),
        { trim: true, retry: true }
    ).then(answer => {
        return actions.takeAction(answer, { action, advisories, command });
    })
        .then(choices => {
            if (choices) {
                return optionsPrompt({ action, advisories, command }, choices)
            }
        })
}

const colors = {
    critical: chalk.bold.white.bgRedBright,
    high: chalk.bold.redBright,
    moderate: chalk.bold.yellow
}
function getSeverityTag(advisory) {
    const color = colors[advisory.severity] || (a => a);
    return color(`[ ${advisory.severity} ]`)
}

function appendWarningLine(message, line) {
    return message + '\n     ' + chalk.bold(line);
}