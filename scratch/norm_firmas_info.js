const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Necesitamos 'canvas' pero no está en package.json.
// Como estamos en un entorno de trabajo, intentaré usar un enfoque que no requiera dependencias pesadas si es posible.
// Si no hay dependencias, usaré PowerShell con .NET que ya está integrado en Windows.

console.log("Para normalizar las firmas, usaremos un script de PowerShell que utiliza .NET, ya que es nativo en Windows y no requiere instalar dependencias adicionales.");
