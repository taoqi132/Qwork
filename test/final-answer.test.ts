import {expect,test} from 'vitest'
import type {Message,Run} from '../src/shared/types'
import {finalAnswer} from '../src/renderer/final-answer'
test('text review presents the answer rather than the final reviewers note',()=>{
 const run={id:'run',contextRevision:1} as Run
 const messages=[{id:'old',runId:'run',role:'agent',collaborationRole:'finalizer',contextRevision:0},{id:'answer',runId:'run',role:'agent',collaborationRole:'producer',contextRevision:1},{id:'review',runId:'run',role:'agent',collaborationRole:'reviewer',contextRevision:1}] as Message[]
 expect(finalAnswer(run,messages)?.id).toBe('answer')
 expect(finalAnswer(run,[messages[0],messages[2]])).toBeUndefined()
})
