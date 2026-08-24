const Jimp = require('jimp');

async function createImages() {
    try {
        console.log('Loading image...');
        const image = await Jimp.read('../img/Recurso gráfico.png');
        
        console.log('Resizing to 164x314 for installerSidebar...');
        image.cover(164, 314);
        
        console.log('Saving as sidebar.bmp...');
        await image.writeAsync('../img/sidebar.bmp');
        
        console.log('Success!');
    } catch (err) {
        console.error(err);
    }
}

createImages();
