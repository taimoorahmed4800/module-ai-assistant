<?php
namespace Taimoor\AiAssistant\Controller\Chat;
use Magento\Customer\Model\Session;
use Magento\Framework\App\Action\HttpPostActionInterface;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\Data\Form\FormKey\Validator;
use Psr\Log\LoggerInterface;
use Taimoor\AiAssistant\Model\Assistant;
class Index implements HttpPostActionInterface
{
    private $request;
    private $jsonFactory;
    private $formKeyValidator;
    private $session;
    private $assistant;
    private $logger;
    public function __construct(RequestInterface $request, JsonFactory $jsonFactory,
        Validator $formKeyValidator, Session $session, Assistant $assistant, LoggerInterface $logger)
    {
        $this->request = $request;
        $this->jsonFactory = $jsonFactory;
        $this->formKeyValidator = $formKeyValidator;
        $this->session = $session;
        $this->assistant = $assistant;
        $this->logger = $logger;
    }
    public function execute()
    {
        $result = $this->jsonFactory->create();
        $result->setHeader('Cache-Control', 'no-store', true);
        if (!$this->formKeyValidator->validate($this->request)) {
            return $result->setHttpResponseCode(400)->setData([
                'success' => false, 'message' => 'Session expired. Refresh and try again.'
            ]);
        }
        $raw = $this->request->getParam('message', '');
        if (!is_string($raw) || trim($raw) === '' || mb_strlen($raw) > 1000) {
            return $result->setHttpResponseCode(400)->setData([
                'success' => false, 'message' => 'Enter a message between 1 and 1000 characters.'
            ]);
        }
        $now = time();
        $last = (int) $this->session->getData('ai_assistant_last_request');
        if ($now - $last < 5) {
            return $result->setHttpResponseCode(429)->setData([
                'success' => false, 'message' => 'Please wait a few seconds before sending again.'
            ]);
        }
        $this->session->setData('ai_assistant_last_request', $now);
        try {
            $answer = $this->assistant->answer(trim($raw));
            return $result->setData([
                'success' => true, 'message' => $answer['message'], 'products' => $answer['products']
            ]);
        } catch (\Throwable $exception) {
            $this->logger->error('AI assistant request failed.', [
                'exception_type' => get_class($exception)
            ]);
            return $result->setHttpResponseCode(503)->setData([
                'success' => false, 'message' => 'Assistant temporarily unavailable. Try again later.'
            ]);
        }
    }
}
