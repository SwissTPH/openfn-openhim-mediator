'use strict'
/**
 * Map selected answers in multiple choice questions to the 
 * corresponding boolean
 * @public
 * @example
 * convertMultipleChoice(chosenAnswers, condition)
 * @constructor
 * @param {string} chosenAnswers - Answers from the multiple choice, picked by the user
 * @param {string} condition - Set that is parent of the possible answers  
 * @returns {Object}
 */
export function convertMultipleChoice(chosenAnswers, condition, conditionsDict, delimiter = " ") {
    // multiples spaces scenario (works)
    let chosenAnswersList = chosenAnswers.split(delimiter)
    var individualSymptoms = {}
    if (chosenAnswers === "s_none") {
        individualSymptoms["s_none"] = true
        return individualSymptoms
    } else {
        let tmp = conditionsDict[condition];
        tmp.forEach(function (element) {
            if (chosenAnswersList.indexOf(element) != -1) {
                individualSymptoms[element] = true
            } else individualSymptoms[element] = false
        })
    } return individualSymptoms;
}

export function checkAnswers(chosenAnswers, target, delimiter = " ") {
    let chosenAnswersList = chosenAnswers.split(delimiter)
    return indexOf(chosenAnswersList, target) != -1
}

export function convertToBoolean(x) {
    if (x === 1 || x === '1' || x === 'true' || x === true) {
        return true;
    } else if (x === 0 || x === '0' || x === -1 || x === '-1' || x === '' || x === 'false' || x === false) {
        return false;
    } else {
        return true;
    }
}

export function indexOf(collection, target) {
    for (var val = 0; val < collection.length; val++) {
        if (collection[val] === target) {
            return val;
        }
    }
    return -1;
}