'use client';

import React, { useEffect, useState } from 'react';

type AssumptionsEntry = {
  saleDiscount: number;
  projectedUpliftOnTVPI: number;
  assetHoldPeriod: number;
  annualInvestmentReturn: number;
  projected_exit_return: number;
};

export default function AuctionDashboard() {
  const pathname = usePathname();
  const dealId = pathname.split('/').slice(-1)[0];
  const { user } = useAppContext();

  const [currentTab, setCurrentTab] = useState('Dashboard');
  const { data: deal, isError, isLoading } = useDeal(parseInt(dealId), user?.id, user?.company);

  const [showPassedBuyers, setShowPassedBuyers] = useState(false);
  const { data: factorsAffecting } = useFactorsAffecting(parseInt(dealId));
  const { data: transactionRounds } = useTransactionRound(Number(dealId));
  const { data: dealTransactions, isLoading: isDealTransactionsLoading } = useDealTransactions(Number(dealId));

  const { data: sellerAnalysisData } = useSellerAnalysis(Number(dealId));
  const [assumptions, setAssumptions] = useState<AssumptionsEntry>({
    saleDiscount: 0,
    projectedUpliftOnTVPI: 0,
    assetHoldPeriod: 0,
    annualInvestmentReturn: 0,
    projected_exit_return: 0.0,
  });
  const [assumptionsConfig, setAssumptionsConfig] = useState<(number | null)[]>([null, null, null, null]);
  const [activeAnalysis, setActiveAnalysis] = useState<SellerAnalysisType | null>(null);

  useEffect(() => {
    if (!isLoading && !deal) {
      redirect('/');
    }
  }, [isLoading, deal]);

  useEffect(() => {
    if (deal && deal.assumptions_config !== undefined) {
      try {
        let parsedConfig: (number | null)[];

        if (typeof deal.assumptions_config === 'string') {
          parsedConfig = JSON.parse(deal.assumptions_config);
        } else if (Array.isArray(deal.assumptions_config)) {
          parsedConfig = deal.assumptions_config;
        } else {
          throw new Error('Unexpected assumptions_config type');
        }

        if (
          Array.isArray(parsedConfig) &&
          parsedConfig.length === 4 &&
          parsedConfig.every((item) => item === null || typeof item === 'number')
        ) {
          setAssumptionsConfig(parsedConfig);
        } else {
          throw new Error('Invalid assumptions_config format');
        }
      } catch (error) {
        console.error('Error parsing assumptions_config:', error);
      }
    }
  }, [deal]);

  useEffect(() => {
    if (sellerAnalysisData && sellerAnalysisData.sellerAnalysis.length > 0) {
      const initialAssumptions: AssumptionsEntry = {
        saleDiscount: assumptionsConfig[0] ?? sellerAnalysisData.sellerAnalysis[0].sale_discount,
        projectedUpliftOnTVPI: assumptionsConfig[1] ?? sellerAnalysisData.sellerAnalysis[0].uplift_on_tvpi,
        assetHoldPeriod: assumptionsConfig[2] ?? sellerAnalysisData.sellerAnalysis[0].asset_hold_period,
        annualInvestmentReturn: assumptionsConfig[3] ?? sellerAnalysisData.sellerAnalysis[0].annual_investment_return,
        projected_exit_return: sellerAnalysisData.sellerAnalysis[0].projected_exit_return,
      };

      setAssumptions(initialAssumptions);
    }
  }, [sellerAnalysisData, assumptionsConfig]);

  useEffect(() => {
    if (sellerAnalysisData) {
      const matchedAnalysis = sellerAnalysisData.sellerAnalysis.find(
        (entry: SellerAnalysisType) =>
          entry.sale_discount === assumptions.saleDiscount &&
          entry.uplift_on_tvpi === assumptions.projectedUpliftOnTVPI &&
          entry.asset_hold_period === assumptions.assetHoldPeriod &&
          entry.annual_investment_return === assumptions.annualInvestmentReturn
      );

      if (matchedAnalysis) {
        setActiveAnalysis(matchedAnalysis);
      } else {
        const customAnalysis: SellerAnalysisType = {
          ...sellerAnalysisData.sellerAnalysis[0],
          sale_discount: assumptions.saleDiscount,
          uplift_on_tvpi: assumptions.projectedUpliftOnTVPI,
          asset_hold_period: assumptions.assetHoldPeriod,
          annual_investment_return: assumptions.annualInvestmentReturn,
          projected_exit_return: assumptions.projected_exit_return,
        };
        setActiveAnalysis(customAnalysis);
      }
    }
  }, [assumptions, setActiveAnalysis]);

  const onTogglePassedBuyers = () => {
    setShowPassedBuyers(!showPassedBuyers);
  };
  const tabs = [
    {
      name: 'Dashboard',
      href: ``,
    },
    {
      name: 'Auction Outcome',
      href: ``,
    },
    {
      name: 'Analytics',
      href: ``,
    },
  ];

  if (isError) {
    return (
      <Container>
        <div>Error...</div>
      </Container>
    );
  }

  const generateProgressItems = (rounds: TransactionRound[]) => {
    if (!rounds || !rounds.length) {
      return [];
    }

    const progressRounds = [];

    let foundInProgress = false;
    let inProgressIndex = 0;

    let i = 0;
    for (const round of rounds) {
      foundInProgress = foundInProgress || round.inProgress;
      if (foundInProgress) {
        inProgressIndex = i;
        break;
      }
      i += 1;
    }

    if (!foundInProgress) {
      rounds[0].inProgress = true;
    }

    let roundIndex = 0;
    for (const round of rounds) {
      foundInProgress = foundInProgress || round.inProgress;
      progressRounds.push({
        title: round.status,
        startDate: round.start_date ? new Date(round.start_date) : new Date(),
        endDate: round.end_date ? new Date(round.end_date) : new Date(),
        status:
          roundIndex < inProgressIndex
            ? 'Completed'
            : round.inProgress
              ? round.status === 'Closed'
                ? 'Completed'
                : 'InProgress'
              : 'NotStarted',
      });
      roundIndex += 1;
    }

    return progressRounds;
  };

  return (
    <Container>
      <div className='flex w-full justify-between'>
        <TitleAndTabs
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          tabs={tabs}
          title={deal?.fund_name || 'N/A'}
        />
        {currentTab === 'Dashboard' && (
          <div className='my-6 flex gap-2'>
            {deal && deal?.status_updates && deal?.status_updates?.length > 0 && (
              <StatusUpdates text={'Status Update'} dealId={dealId} large={true} />
            )}
            {deal && <TrackProgress trackDetails={generateProgressItems(transactionRounds)} deal={deal} />}
          </div>
        )}
      </div>
      {
        {
          Dashboard: (
            <div className='my-6'>
              <RoundTracking transactionRounds={transactionRounds.slice(0, 3)} />
              <div className='my-8 flex w-full flex-col gap-8 rounded-2xl bg-white p-6'>
                <div className='flex w-full items-center justify-between'>
                  <p className='text-3xl font-[500]'>Bidders</p>
                  <ToggleSwitch onTogglePassedBuyers={onTogglePassedBuyers} />
                </div>
                <div className='rounded-lg'>
                  {isDealTransactionsLoading ? (
                    <LoadingSpinner />
                  ) : (
                    <BuyersInProgress
                      dealTransactions={dealTransactions}
                      transactionRounds={transactionRounds.slice(0, 3)}
                      showPassedBuyers={showPassedBuyers}
                    />
                  )}
                </div>
              </div>
            </div>
          ),
          'Auction Outcome': <div className='my-6'>{deal && <AuctionOutcome deal={deal} />} </div>,
          Analytics: (
            <>
              {deal && sellerAnalysisData && sellerAnalysisData.sellerAnalysis && (
                <Analytics
                  sellerAnalysis={sellerAnalysisData.sellerAnalysis}
                  activeAnalysis={activeAnalysis}
                  assumptions={assumptions}
                  setAssumptions={setAssumptions}
                  assumptionsConfig={assumptionsConfig}
                  deal={deal}
                  factorsAffecting={factorsAffecting}
                />
              )}
            </>
          ),
        }[currentTab]
      }
    </Container>
  );
}
