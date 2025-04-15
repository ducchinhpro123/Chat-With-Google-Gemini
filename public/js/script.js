// Frontend script to communicate with our Express server API
function removeErrorMesgDiv(errorMessageDiv) {
  if (document.body.contains(errorMessageDiv)) {
    document.body.removeChild(errorMessageDiv);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.createElement('form');
  const input = document.createElement('textarea');
  const button = document.createElement('button');
  const responseDiv = document.createElement('div');
  const errorMessageDiv = document.createElement('div');
  const isSearch = document.createElement('input');

  function auto_grow(element) {
    element.style.height = "5px";
    element.style.height = (element.scrollHeight) + "px";
  }

  // If set, call perplexity for search functionality
  isSearch.type = 'checkbox';

  // Set up UI elements
  input.placeholder = 'Enter your prompt for Gemini AI...';
  // input.rows = 1;
  input.style.width = '100%';
  input.style.marginBottom = '10px';

  input.addEventListener('input', () => {
    auto_grow(input);
  });

  button.textContent = 'Generate Response';
  responseDiv.id = 'ai-response';
  responseDiv.style.whiteSpace = 'pre-wrap';
  responseDiv.style.marginTop = '20px';

  // Add elements to form
  form.appendChild(input);
  form.appendChild(button);
  form.appendChild(isSearch);

  document.body.appendChild(form);
  document.body.appendChild(responseDiv);

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = input.value.trim();
    const isSearchChecked = isSearch.checked;

    if (!prompt) {
      removeErrorMesgDiv(errorMessageDiv);
      errorMessageDiv.textContent = "Prompt is invalid";
      document.body.appendChild(errorMessageDiv);
      return;
    };

    button.disabled = true;
    button.textContent = 'Generating...';
    responseDiv.textContent = 'Waiting for response...';

    try {
      // Make an API call to our Express server
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt, isSearchChecked })
      });

      if (!response.ok) {
        removeErrorMesgDiv(errorMessageDiv);
        errorMessageDiv.textContent = response.error;
        document.body.appendChild(errorMessageDiv);
        throw new Error('Failed to get response from server');
      }

      const data = await response.json();

      const rawHtml = marked.parse(data.text);
      const safeHtml = DOMPurify.sanitize(rawHtml);

      responseDiv.innerHTML = safeHtml;

    } catch (error) {
      responseDiv.textContent = `Error: ${error.message}`;
    } finally {
      button.disabled = false;
      button.textContent = 'Generate Response';
    }
  });
});
