document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('[data-file-form]');
    forms.forEach(initFileForm);
});


function initFileForm(form) {
    const fileInput = form.querySelector('[data-new-files-input]');
    const newFilesContainer = form.querySelector('[data-new-files]');
    const existingFilesContainer = form.querySelector('[data-existing-files]');
    const deletedInput = form.querySelector('[data-deleted-file-ids]');
    const emptyMessage = form.querySelector('[data-files-empty]');

    if (!fileInput || !newFilesContainer || !existingFilesContainer || !deletedInput)  return;

    let selectedFiles = [];
    let deletedFileIds = [];


    existingFilesContainer.addEventListener( 'click',
        event => {
            const button = event.target.closest('[data-remove-existing]');
            if (!button) return;

            const fileElement = button.closest('[data-existing-file]');
            if (!fileElement) return;
            
            const fileId =fileElement.dataset.fileId;
            if (!fileId) return;
          
            if (!deletedFileIds.includes(fileId)) deletedFileIds.push(fileId);

            deletedInput.value = JSON.stringify(deletedFileIds);
            fileElement.remove();
            updateEmptyMessage();

        }
    );


    fileInput.addEventListener('change',
        () => {
            const newFiles = Array.from(fileInput.files);

            const existingCount =
                existingFilesContainer.querySelectorAll(
                    '[data-existing-file]'
                ).length;

            const availableSlots =
                3 -
                existingCount -
                selectedFiles.length;


            if (availableSlots <= 0) {
                alert( 'Можно прикрепить максимум 3 файла.');
                fileInput.value = '';
                return;
            }

            const filesToAdd = newFiles.slice(0, availableSlots);

            if (newFiles.length > availableSlots) {
                alert(`Можно добавить только ${availableSlots} файл(а). Максимум — 3 файла.`);}


            filesToAdd.forEach(file => {
                const alreadySelected =
                    selectedFiles.some(
                        selected =>
                            selected.name === file.name &&
                            selected.size === file.size &&
                            selected.lastModified === file.lastModified
                    );

                if (!alreadySelected) selectedFiles.push(file);
            });

            updateInputFiles();
            renderNewFiles();
            updateEmptyMessage();
        }
    );

    newFilesContainer.addEventListener('click',
        event => {
            const button = event.target.closest('[data-remove-new]');

            if (!button) return;
            
            const index = Number(button.dataset.index);
           
            if (Number.isNaN(index) || index < 0 || index >= selectedFiles.length) return;
            
            selectedFiles.splice(index, 1);

            updateInputFiles();
            renderNewFiles();
            updateEmptyMessage();
        }
    );


    form.addEventListener('submit',
        event => {

            const existingCount =
                existingFilesContainer.querySelectorAll(
                    '[data-existing-file]'
                ).length;

            const totalCount = existingCount + selectedFiles.length;

            if (totalCount > 3) {
                event.preventDefault();

                alert('Можно прикрепить не более 3 файлов.');
                return;
            }

            deletedInput.value = JSON.stringify(deletedFileIds);
            updateInputFiles();
        }
    );

    function renderNewFiles() {
        newFilesContainer.innerHTML = '';

        selectedFiles.forEach(
            (file, index) => {

                const element = document.createElement('div');
                element.className = 'task-file task-file--new';

                const name = document.createElement('span');
                name.className = 'task-file__name';
                name.textContent =` ${file.name}`;

                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'link-button link-button--danger';
                removeButton.textContent = 'Удалить';
                removeButton.dataset.removeNew = '';
                removeButton.dataset.index =index;

                element.appendChild(name);
                element.appendChild(removeButton);

                newFilesContainer.appendChild(element);
            }
        );
    }

    function updateInputFiles() {
        const dataTransfer = new DataTransfer();
        selectedFiles.forEach(file => {dataTransfer.items.add(file);});
        fileInput.files = dataTransfer.files;
    }

    function updateEmptyMessage() {
        if (!emptyMessage) return;

        const existingCount =
            existingFilesContainer.querySelectorAll(
                '[data-existing-file]'
            ).length;


        const totalCount = existingCount + selectedFiles.length;
        emptyMessage.hidden = totalCount > 0;
    }
}