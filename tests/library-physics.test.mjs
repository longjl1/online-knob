import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatFlipValue } from '../src/components/mechanical-flip/value.ts'
import { ReturnSpring, pullResistance, normalizeThreshold } from '../src/components/spring-pull/physics.ts'

test('flip formatting wraps, pads, truncates and handles invalid input',()=>{
  assert.equal(formatFlipValue(42,4),'0042');assert.equal(formatFlipValue(-1,4),'9999')
  assert.equal(formatFlipValue(10001,4),'0001');assert.equal(formatFlipValue(NaN,4),'0000')
  assert.equal(formatFlipValue(12.8,2),'12');assert.equal(formatFlipValue(1,99).length,6)
})
test('pull resistance increases with diminishing travel and clamps negative pulls',()=>{
  assert.equal(pullResistance(-4,200),0)
  assert.ok(pullResistance(200,200)>pullResistance(100,200))
  assert.ok(pullResistance(200,200)-pullResistance(100,200)<pullResistance(100,200))
  assert.equal(normalizeThreshold(NaN),.72)
})
test('return spring settles from full tension at different refresh rates',()=>{
  for(const fps of [60,120,144]){
    const spring=new ReturnSpring();spring.position=1
    let bounced=false
    for(let i=0;i<fps*2;i++){spring.advance(1/fps,false);if(spring.position<0)bounced=true}
    assert.equal(spring.position,0);assert.equal(spring.moving,false);assert.equal(bounced,true)
  }
})
