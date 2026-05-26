namespace TiaOpennessWrapper.Services.HW.Cax;

public class CaxOperationResult
{
	public bool Success { get; }

	public string? FilePath { get; }

	public string? LogPath { get; }

	public string? Error { get; }

	private CaxOperationResult(bool success, string? filePath, string? logPath, string? error)
	{
		Success = success;
		FilePath = filePath;
		LogPath = logPath;
		Error = error;
	}

	public static CaxOperationResult Ok(string filePath, string logPath)
	{
		return new CaxOperationResult(success: true, filePath, logPath, null);
	}

	public static CaxOperationResult Failure(string error)
	{
		return new CaxOperationResult(success: false, null, null, error);
	}
}
