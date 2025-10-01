export default function Privacy() {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">Last Updated: October 1, 2025</p>
          
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">What We Store</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Technical email ID (not the email address itself)</li>
                <li>When the email was received (timestamp)</li>
                <li>Email categorization labels (Work, Personal, Shopping, etc.)</li>
                <li>Reply urgency classification (High, Medium, Low)</li>
              </ul>
              <p className="text-gray-700 mt-3">
                <strong>Nothing we store reveals the actual content of your emails.</strong> Your emails remain completely private to you.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold mb-3">How Email Processing Works</h2>
              <p className="text-gray-700 mb-2">
                When you use Inboxie, email metadata (sender, subject) is sent to OpenAI's API for categorization. 
                This happens in real-time:
              </p>
              <ol className="list-decimal pl-6 space-y-2 text-gray-700">
                <li>A machine (AI) reads the metadata to categorize your email</li>
                <li>The categorization is returned to the extension</li>
                <li>The information is immediately purged from memory</li>
                <li>No humans ever read your email data</li>
              </ol>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold mb-3">Authentication & Access Tokens</h2>
              <p className="text-gray-700">
                Your Gmail access token is stored temporarily in your browser's secure storage during your session. 
                When the context is cleared, you'll need to log in again. We never permanently store your access credentials.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold mb-3">Data Storage</h2>
              <p className="text-gray-700">
                Category preferences and email classifications are stored in our secure database. 
                This data cannot be used to reconstruct the content of your emails.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold mb-3">Third-Party Services</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Google Gmail API:</strong> For accessing your email metadata</li>
                <li><strong>OpenAI API:</strong> For AI-powered categorization (processed in real-time, not stored)</li>
              </ul>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold mb-3">Your Privacy Rights</h2>
              <p className="text-gray-700">
                You can request deletion of your data at any time. 
                Uninstalling the extension stops all data collection immediately.
              </p>
            </section>
  
            <section>
              <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
              <p className="text-gray-700">
                Questions about privacy? Email us at: <strong>support@inboxie.ai</strong>
              </p>
            </section>
          </div>
        </div>
      </div>
    );
  }