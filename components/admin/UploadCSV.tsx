import { createSignal, Show } from 'solid-js';
import { uploadTokenSaleData, TokenSaleEntry, sendInvitationEmail } from '../../services/firebaseService';

export const UploadCSV = () => {
    const [dragActive, setDragActive] = createSignal(false);
    const [file, setFile] = createSignal<File | null>(null);
    const [parsedData, setParsedData] = createSignal<TokenSaleEntry[]>([]);
    const [isUploading, setIsUploading] = createSignal(false);
    const [uploadStatus, setUploadStatus] = createSignal<{ success: boolean, message: string } | null>(null);
    const [uploadResult, setUploadResult] = createSignal<{ newInvitations: string[], existingMembers: string[] } | null>(null);

    const handleDrag = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            setFile(droppedFile);
            setUploadStatus(null);
            setUploadResult(null);
            const data = await parseCSV(droppedFile);
            setParsedData(data);
        }
    };

    const handleChange = async (e: any) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setUploadStatus(null);
            setUploadResult(null);
            const data = await parseCSV(selectedFile);
            setParsedData(data);
        }
    };

    const parseCSV = async (file: File): Promise<TokenSaleEntry[]> => {
        const text = await file.text();
        const lines = text.split('\n');
        // Simple validation or skip header

        const entries: TokenSaleEntry[] = [];

        // Start from index 1 to skip header
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',').map(v => v.trim());

            // Map based on expected order: email, partnerCode, amountToken, date, unlockRatio, vestingPeriod
            if (values.length >= 6) {
                entries.push({
                    email: values[0],
                    partnerCode: values[1],
                    amountToken: Number(values[2]),
                    date: values[3],
                    unlockRatio: Number(values[4]),
                    vestingPeriod: Number(values[5]),
                    status: 'Pending'
                });
            }
        }
        return entries;
    };

    const handleUpload = async () => {
        if (!file() || parsedData().length === 0) return;
        setIsUploading(true);
        try {
            // Use the already parsed data
            const entries = parsedData();
            const result = await uploadTokenSaleData(entries);

            // Send invitation emails ONLY for new users (newInvitations)
            let emailCount = 0;
            const baseUrl = window.location.origin;

            for (const email of result.newInvitations) {
                try {
                    // Find the original entry to get partnerCode
                    const entry = entries.find(e => e.email.toLowerCase() === email.toLowerCase());
                    if (entry) {
                        await sendInvitationEmail(email, entry.partnerCode, baseUrl);
                        emailCount++;
                    }
                } catch (err) {
                    console.error(`Failed to send email to ${email}:`, err);
                }
            }

            setUploadResult({
                newInvitations: result.newInvitations,
                existingMembers: result.existingMembers
            });

            setUploadStatus({
                success: true,
                message: `성공적으로 ${result.count}건을 처리했습니다. ${emailCount}명의 신규 사용자를 초대하고, ${result.existingMembers.length}명의 기존 회원 정보를 업데이트했습니다.`
            });

            // Clear file selection after successful upload but keep result view
            setFile(null);
            setParsedData([]);

        } catch (error) {
            console.error(error);
            setUploadStatus({
                success: false,
                message: 'Failed to parse or upload CSV. Please check format.'
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div class="text-slate-300">
            <h2 class="text-xl font-bold text-white mb-6">Upload User Data (CSV)</h2>

            <div class="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 mb-8 text-amber-500 text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                Note: Duplicate email addresses will be excluded. Only unique email entries will be stored. File must follow the required CSV format.
            </div>

            <div class="mb-6">
                <label class="block text-sm font-medium mb-2 text-slate-400">CSV Format Requirements</label>
                <div class="bg-[#0B0E14] border border-slate-700 rounded-lg p-3 text-slate-500 text-sm font-mono">
                    email, PartnerCode, amountToken, date, unlockRatio, vestingperiod
                </div>
            </div>

            {/* Drag & Drop Area */}
            <Show when={!uploadStatus()?.success}>
                <div
                    class={`border-2 border-dashed rounded-2xl h-64 flex flex-col items-center justify-center transition-all duration-300 mb-8 cursor-pointer
                        ${dragActive()
                            ? 'border-indigo-500 bg-indigo-500/10'
                            : 'border-slate-700 bg-[#0B0E14]/50 hover:border-slate-600'}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div class="text-center">
                        <Show when={!file()} fallback={
                            <div class="flex flex-col items-center">
                                <div class="bg-green-500/20 p-3 rounded-full mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span class="text-white font-medium">{file()?.name}</span>
                                <span class="text-slate-500 text-sm mt-1">{(file()!.size / 1024).toFixed(1)} KB</span>
                            </div>
                        }>
                            <p class="text-slate-400 mb-4">Click to upload or drag and drop</p>
                            <label class="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg cursor-pointer transition-colors inline-block">
                                Select File
                                <input type="file" class="hidden" accept=".csv" onChange={handleChange} />
                            </label>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* CSV Preview Table */}
            <Show when={parsedData().length > 0}>
                <div class="mb-8 overflow-hidden rounded-xl border border-slate-700">
                    <div class="bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                        <h3 class="font-bold text-white text-sm">Preview Data ({parsedData().length} entries)</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm text-left text-slate-400">
                            <thead class="text-xs text-slate-300 uppercase bg-slate-800/50">
                                <tr>
                                    <th class="px-6 py-3">Email</th>
                                    <th class="px-6 py-3">Partner</th>
                                    <th class="px-6 py-3 text-right">Amount</th>
                                    <th class="px-6 py-3">Date</th>
                                    <th class="px-6 py-3 text-right">Unlock %</th>
                                    <th class="px-6 py-3 text-right">Vesting (M)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {parsedData().slice(0, 5).map((entry, index) => (
                                    <tr class="border-b border-slate-700 hover:bg-slate-800/20">
                                        <td class="px-6 py-4 font-medium text-white">{entry.email}</td>
                                        <td class="px-6 py-4">{entry.partnerCode}</td>
                                        <td class="px-6 py-4 text-right">{entry.amountToken.toLocaleString()}</td>
                                        <td class="px-6 py-4">{entry.date}</td>
                                        <td class="px-6 py-4 text-right">{entry.unlockRatio}%</td>
                                        <td class="px-6 py-4 text-right">{entry.vestingPeriod}</td>
                                    </tr>
                                ))}
                                {parsedData().length > 5 && (
                                    <tr>
                                        <td colspan="6" class="px-6 py-3 text-center text-xs text-slate-500 italic">
                                            ... and {parsedData().length - 5} more entries
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="flex justify-end mb-8">
                    <button
                        class={`px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${isUploading()
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-500/20'
                            }`}
                        onClick={handleUpload}
                        disabled={isUploading()}
                    >
                        {isUploading() ? 'Processing...' : 'Confirm Upload & Process'}
                    </button>
                </div>
            </Show>

            {/* Status Message */}
            <Show when={uploadStatus()}>
                <div class={`mt-6 p-6 rounded-xl border ${uploadStatus()?.success
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                    <div class="flex items-center gap-3 mb-2">
                        {uploadStatus()?.success ? (
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <div class="font-bold text-lg">
                            {uploadStatus()?.success ? 'Upload Success' : 'Upload Failed'}
                        </div>
                    </div>
                    <div class="ml-9 opacity-90">{uploadStatus()?.message}</div>
                </div>
            </Show>

            {/* Result Tables Container */}
            <Show when={uploadResult()}>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">

                    {/* Newly Invited Users */}
                    <Show when={uploadResult()?.newInvitations.length! > 0}>
                        <div>
                            <h3 class="text-white font-bold mb-4 flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                                Newly Invited ({uploadResult()?.newInvitations.length})
                            </h3>
                            <div class="bg-[#0B0E14] border border-green-900/30 rounded-xl overflow-hidden shadow-lg shadow-green-900/10">
                                <div class="max-h-60 overflow-y-auto custom-scrollbar">
                                    <table class="w-full text-sm text-left text-slate-400">
                                        <thead class="text-xs text-slate-500 uppercase bg-slate-900/50 sticky top-0 backdrop-blur-sm">
                                            <tr>
                                                <th class="px-6 py-3">Email</th>
                                                <th class="px-6 py-3 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uploadResult()?.newInvitations.map((email) => (
                                                <tr class="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                                    <td class="px-6 py-3 font-mono text-slate-300">{email}</td>
                                                    <td class="px-6 py-3 text-right text-green-400 text-xs font-bold uppercase">Invited</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Existing/Updated Members */}
                    <Show when={uploadResult()?.existingMembers.length! > 0}>
                        <div>
                            <h3 class="text-white font-bold mb-4 flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
                                Updated Members ({uploadResult()?.existingMembers.length})
                            </h3>
                            <div class="bg-[#0B0E14] border border-blue-900/30 rounded-xl overflow-hidden shadow-lg shadow-blue-900/10">
                                <div class="max-h-60 overflow-y-auto custom-scrollbar">
                                    <table class="w-full text-sm text-left text-slate-400">
                                        <thead class="text-xs text-slate-500 uppercase bg-slate-900/50 sticky top-0 backdrop-blur-sm">
                                            <tr>
                                                <th class="px-6 py-3">Email</th>
                                                <th class="px-6 py-3 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {uploadResult()?.existingMembers.map((email) => (
                                                <tr class="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                                    <td class="px-6 py-3 font-mono text-slate-300">{email}</td>
                                                    <td class="px-6 py-3 text-right text-blue-400 text-xs font-bold uppercase">Updated</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
};
