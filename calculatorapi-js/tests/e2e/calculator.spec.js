const { test, expect } = require('@playwright/test');

test.describe('Calculatrice E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('devrait effectuer une addition simple via le pavé numérique', async ({ page }) => {
    await page.getByRole('button', { name: '5', exact: true }).click();
    
    await page.getByRole('button', { name: '+' }).click();
    
    await page.getByRole('button', { name: '3', exact: true }).click();
    
    await page.getByRole('button', { name: "Confirmer l'opération" }).click();

    const mainDisplay = page.locator('#mainDisplay');
    await expect(mainDisplay).toHaveText('8');

    const historyLog = page.locator('#historyLog');
    await expect(historyLog).toContainText('5 + 3 = 8');
  });

  test('devrait enchaîner un calcul en utilisant le résultat précédent', async ({ page }) => {
    await page.getByRole('button', { name: '9', exact: true }).click();
    await page.getByRole('button', { name: '÷' }).click();
    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByRole('button', { name: "Confirmer l'opération" }).click();

    await page.getByRole('button', { name: '✕' }).click();
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByRole('button', { name: "Confirmer l'opération" }).click();

    const mainDisplay = page.locator('#mainDisplay');
    await expect(mainDisplay).toHaveText('12');
  });

  test('devrait réinitialiser l\'écran lors du clic sur le bouton C', async ({ page }) => {
    await page.getByRole('button', { name: '7', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    
    await page.getByRole('button', { name: 'C', exact: true }).click();

    const mainDisplay = page.locator('#mainDisplay');
    await expect(mainDisplay).toHaveText('0');
  });
});