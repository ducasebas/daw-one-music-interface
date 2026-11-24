import {expect} from '@playwright/test';
/** Waking from screen rest is press-and-hold (GUI 3.16.2): wait until rest accepts input, then hold. */
export async function holdToWake(page,surface){
 await expect(surface).toHaveAttribute('data-armed','true');
 const box=await surface.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();await page.waitForTimeout(800);await page.mouse.up();
}
