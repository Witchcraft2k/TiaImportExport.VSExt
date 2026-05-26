namespace TiaOpennessWrapper.Services;

public class ExportCounters
{
	public int Success;

	public int Error;

	public int Skipped;

	public int Total => Success + Error + Skipped;
}
