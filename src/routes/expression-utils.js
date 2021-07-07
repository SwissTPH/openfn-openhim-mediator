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
export function convertMultipleChoice(chosenAnswers, condition){
    conditionsDict = {
        s_cough:['s_difficult_breathing', 's_coryza', 's_cough', 's_none'],
        s_danger_look:['s_convulsion','s_lethargic','s_none'],
        s_danger_ask:['s_no_drink', 's_throw','s_convulsion_epi','s_none'],
        s_immunizations_received:['s_bcg','s_opv0','s_opv1','s_opv2','s_opv3','s_pentavalent1','s_pentavalent2','s_pentavalent3','s_ipv1','s_ipv2','s_measles1','s_measles2','s_none'],
        s_malnutrition:['s_wasting_severe','s_oedema_bilateral','s_no_weight_gain','s_not_sucking','s_none']
    }
    chosenAnswersList = chosenAnswers.split(" ")
    // Assumption 1: One option will not come in multiple lists
    // Assumption 2: The key of the multiple choice is allways the
    // same depending on what multiple choice question was answered
    // e.g. the key to the cough multiple choice answers will always
    // be s_cough ("s_cough":"s_difficult_breathing" ...)
    individualSymptoms = {}
    if (chosenAnswers === "s_none"){
            individualSymptoms["s_none"] = true
        return individualSymptoms
    }else{
        tmp = conditionsDict[condition];
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