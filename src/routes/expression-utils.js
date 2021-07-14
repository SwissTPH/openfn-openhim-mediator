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
export function convertMultipleChoice(chosenAnswers, condition, conditionsDict){
    let chosenAnswersList = chosenAnswers.split(" ")
    var individualSymptoms = {}
    if (chosenAnswers === "s_none"){
            individualSymptoms["s_none"] = true
        return individualSymptoms
    }else{
        let tmp = conditionsDict[condition];
        tmp.forEach(function(element){
            if (chosenAnswersList.indexOf(element) != -1){
                individualSymptoms[element] = true
            }else individualSymptoms[element] = false
        })
    }return individualSymptoms;
}

export function converter(x) {
    if(x === 1 || x === '1'){
        return true;
    }else if(x === 0 || x === '0' || x === -1 || x === '-1'){
        return false;
    }else{
        return x;
    }
}

export function indexOf(collection, target) {
    for(var val=0; val<collection.length; val++){
       if(collection[val] === target){
          return val;
        }
    }
    return -1;
}